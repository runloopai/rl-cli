"""Object command group implementation."""
import os
import io
import shutil
import tempfile
import zipfile
import tarfile
import aiohttp
import asyncio
import sys
import mimetypes
import zstandard
import inspect
from typing import Optional, Literal
from pathlib import Path
from tabulate import tabulate
from ..utils import runloop_api_client
# Retry settings (override via env if needed)
RETRY_ATTEMPTS = int(os.getenv("RUNLOOP_RETRIES", "3"))
RETRY_BASE_DELAY_SEC = float(os.getenv("RUNLOOP_RETRY_BASE_DELAY", "0.5"))

def _is_transient_error(error: Exception) -> bool:
    """Heuristic to classify transient server/network errors suitable for retry."""
    if isinstance(error, aiohttp.ClientError):
        return True
    text = str(error)
    if any(token in text for token in (" 500", " 502", " 503", " 504", "HTTP 5")):
        return True
    return False

async def _retry_async(operation, *, attempts: int = RETRY_ATTEMPTS, base_delay_sec: float = RETRY_BASE_DELAY_SEC):
    """Retry an awaitable factory on transient errors with exponential backoff."""
    last_error = None
    for attempt in range(attempts + 1):
        try:
            return await operation()
        except Exception as e:  # noqa: BLE001
            last_error = e
            if attempt == attempts or not _is_transient_error(e):
                break
            await asyncio.sleep(base_delay_sec * (2 ** attempt))
    raise last_error  # noqa: RSE102


# Map common file extensions to MIME types
CONTENT_TYPE_MAP = {
    # Text files
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.csv': 'text/csv',
    '.md': 'text/plain',  # Markdown files as plain text
    
    # Application files
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.gz': 'application/gzip',
    '.tar': 'application/x-tar',
    '.tgz': 'application/x-tar+gzip',
    '.tar.gz': 'application/x-tar+gzip',  # Alias for .tgz
    '.zst': 'application/zstd',
    '.tar.zst': 'application/x-tar+zstd',
    
    # Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
}

# Create reverse mapping from MIME types to preferred extensions
MIME_TYPE_MAP = {mime_type: ext for ext, mime_type in CONTENT_TYPE_MAP.items()}
# Prefer .txt for text/plain
MIME_TYPE_MAP['text/plain'] = '.txt'

def is_archive(file_path: str) -> bool:
    """Check by extension if file is a supported archive type (heuristic)."""
    return file_path.lower().endswith(('.zip', '.tar.gz', '.tgz', '.zst', '.tar.zst'))

def _has_zstd_magic(file_path: str) -> bool:
    """Return True if file begins with zstd magic number."""
    try:
        with open(file_path, 'rb') as f:
            head = f.read(4)
        return head == b'\x28\xb5/\xfd'
    except Exception:
        return False

def is_extractable(file_path: str) -> bool:
    """Content-aware check whether an archive can be extracted by us."""
    if zipfile.is_zipfile(file_path):
        return True
    if tarfile.is_tarfile(file_path):
        return True
    if _has_zstd_magic(file_path):
        return True
    return False

def safe_extract_tar(tar_ref, extract_dir: str) -> None:
    """Safely extract a tar archive to a directory."""
    def is_within_directory(directory, target):
        abs_directory = os.path.abspath(directory)
        abs_target = os.path.abspath(target)
        prefix = os.path.commonprefix([abs_directory, abs_target])
        return prefix == abs_directory

    for member in tar_ref.getmembers():
        member_path = os.path.join(extract_dir, member.name)
        if not is_within_directory(extract_dir, member_path):
            raise RuntimeError("Attempted path traversal in tar file")
    tar_ref.extractall(extract_dir, filter='data')

def extract_archive(archive_path: str, extract_dir: str) -> None:
    """Extract archive to specified directory."""
    path_lower = archive_path.lower()

    # Prefer content-based detection first
    if zipfile.is_zipfile(archive_path):
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
        return

    if tarfile.is_tarfile(archive_path):
        with tarfile.open(archive_path, 'r:*') as tar_ref:
            safe_extract_tar(tar_ref, extract_dir)
        return
    
    # Handle ZIP files
    if path_lower.endswith('.zip'):
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
    
    # Handle tar.gz and tgz files
    elif path_lower.endswith(('.tar.gz', '.tgz')):
        with tarfile.open(archive_path, 'r:gz') as tar_ref:
            safe_extract_tar(tar_ref, extract_dir)
    
    # Handle tar.zst files
    elif path_lower.endswith('.tar.zst'):
        # First decompress to a temporary tar file
        temp_tar = archive_path + '.tar'
        try:
            if not _has_zstd_magic(archive_path):
                raise RuntimeError('File does not appear to be zstd-compressed')
            dctx = zstandard.ZstdDecompressor()
            with open(archive_path, 'rb') as compressed:
                with open(temp_tar, 'wb') as decompressed:
                    dctx.copy_stream(compressed, decompressed)
            
            # Now extract the tar file
            with tarfile.open(temp_tar, 'r:') as tar:
                safe_extract_tar(tar, extract_dir)
        finally:
            # Clean up temporary tar file
            if os.path.exists(temp_tar):
                os.unlink(temp_tar)
    
    # Handle single-file zst compression
    elif path_lower.endswith('.zst'):
        dctx = zstandard.ZstdDecompressor()
        output_name = os.path.splitext(os.path.basename(archive_path))[0]
        output_path = os.path.join(extract_dir, output_name)
        os.makedirs(extract_dir, exist_ok=True)  # Create the extraction directory
        if not _has_zstd_magic(archive_path):
            raise RuntimeError('File does not appear to be zstd-compressed')
        with open(archive_path, 'rb') as compressed:
            with open(output_path, 'wb') as decompressed:
                dctx.copy_stream(compressed, decompressed)

def detect_content_type(file_path: str) -> str:
    """Detect content type based on file extension.
    
    Args:
        file_path: Path to the file
        
    Returns:
        str: API content type (e.g., 'text/plain', 'application/json')
    """
    # Get the file extension (lowercase)
    ext = os.path.splitext(file_path)[1].lower()

    # The API enum doesn't accept application/zstd; use generic for uploads
    if ext in ('.zst', '.tar.zst'):
        return 'application/octet-stream'

    # Check our custom mapping first
    if ext in CONTENT_TYPE_MAP:
        return CONTENT_TYPE_MAP[ext]
    
    # For unknown types, return application/octet-stream
    return 'application/octet-stream'

async def list_objects(args) -> None:
    """List objects with optional filtering."""
    params = {}
    
    if hasattr(args, "limit"):
        params["limit"] = args.limit
    if hasattr(args, "starting_after"):
        params["starting_after"] = args.starting_after
    if hasattr(args, "name"):
        params["name"] = args.name
    if hasattr(args, "content_type"):
        params["content_type"] = args.content_type
    if hasattr(args, "state"):
        params["state"] = args.state
    if hasattr(args, "search"):
        params["search"] = args.search
    if hasattr(args, "is_public") and args.is_public:
        params["is_public"] = True

    # Use the public endpoint if specified
    if hasattr(args, "public") and args.public:
        objects = await runloop_api_client().objects.list_public(**params)
    else:
        objects = await runloop_api_client().objects.list(**params)

    # Convert objects to a list of dictionaries for tabulate
    table_data = []
    for obj in objects.objects:
        # Format size in human-readable format
        size = "N/A"
        if obj.size_bytes is not None:
            if obj.size_bytes < 1024:
                size = f"{obj.size_bytes} B"
            elif obj.size_bytes < 1024 * 1024:
                size = f"{obj.size_bytes / 1024:.1f} KB"
            else:
                size = f"{obj.size_bytes / (1024 * 1024):.1f} MB"
        
        table_data.append({
            "ID": obj.id,
            "Name": obj.name,
            "Type": obj.content_type,
            "State": obj.state,
            "Size": size
        })
    
    if not table_data:
        print("No objects found.")
        return
    
    # Print the table
    print(tabulate(table_data, headers="keys", tablefmt="grid"))

async def get(args) -> None:
    """Get a specific object."""
    assert args.id is not None
    object = await runloop_api_client().objects.retrieve(args.id)
    print(f"object={object.model_dump_json(indent=4)}")

async def download(args) -> None:
    """Download an object to a local file and optionally extract it."""
    assert args.id is not None
    assert args.path is not None

    # Ensure we pick up the patched client in tests and latest env
    try:
        runloop_api_client.cache_clear()
    except Exception:
        pass

    # Get the object metadata first
    object = await runloop_api_client().objects.retrieve(args.id)
    
    # Get the download URL
    duration_seconds = args.duration_seconds if hasattr(args, "duration_seconds") else 3600
    download_url_response = await runloop_api_client().objects.download(
        args.id, duration_seconds=duration_seconds
    )
    download_url = download_url_response.download_url

    # Determine the download path
    if getattr(args, 'extract', False):
        # When extracting, download to a temporary file first with correct extension
        # Prefer extension from object name
        ext = None
        name = object.name
        if inspect.isawaitable(name):
            name = await name
        if isinstance(name, str) and name:
            name_lower = name.lower()
            if name_lower.endswith(('.tar.gz', '.tar.zst')):
                ext = '.' + '.'.join(name_lower.split('.')[-2:])
            else:
                ext = os.path.splitext(name)[1]
        
        # Fallback: derive from content type
        if not ext:
            content_type = object.content_type
            if inspect.isawaitable(content_type):
                content_type = await content_type
            ext = MIME_TYPE_MAP.get(content_type)
        
        # Decide filename: use object.name only for archives
        archive_exts = ('.zip', '.tar.gz', '.tgz', '.zst', '.tar.zst')
        is_archive_ext = False
        base_name_candidate = None
        if isinstance(name, str) and name:
            base_name_candidate = os.path.basename(name)
            name_lower = name.lower()
            is_archive_ext = name_lower.endswith(archive_exts)
        else:
            # fall back to ext check only
            if ext in archive_exts:
                is_archive_ext = True
        
        if is_archive_ext and base_name_candidate:
            temp_basename = base_name_candidate
        else:
            # id-based temp name, ensure ext appended if present
            temp_basename = f"rl_cli_download_{args.id}"
            if ext and not temp_basename.lower().endswith(ext.lower()):
                temp_basename += ext
        
        download_path = os.path.join(tempfile.gettempdir(), temp_basename)
    else:
        # When not extracting, use the specified path
        download_path = os.path.abspath(args.path)
        os.makedirs(os.path.dirname(download_path), exist_ok=True)

    # Download the file
    async with aiohttp.ClientSession() as session:
        try:
            response = await _retry_async(lambda: session.get(download_url))
        except aiohttp.ClientError as e:
            raise RuntimeError(f"Network error during download: {str(e)}")
        
        if response.status != 200:
            try:
                error_text = await response.text()
            except Exception:
                error_text = ""
            try:
                response.close()
            finally:
                pass
            raise RuntimeError(f"Failed to download file: HTTP {response.status} {error_text}")
        
        # Get total size for progress reporting
        total_size = int(response.headers.get('content-length', 0))
        
        # Open file and write chunks
        try:
            with open(download_path, 'wb') as f:
                bytes_downloaded = 0
                async for chunk in response.content.iter_chunked(8192):
                    f.write(chunk)
                    bytes_downloaded += len(chunk)
                    if total_size:
                        progress = (bytes_downloaded / total_size) * 100
                        print(f"\rDownloading: {progress:.1f}%", end='', flush=True, file=sys.stderr)
                
                if total_size:
                    print(file=sys.stderr)  # New line after progress
        except OSError as e:
            raise RuntimeError(f"Failed to write downloaded file: {str(e)}")

    # Print download path only when not extracting
    if not getattr(args, 'extract', False):
        print(f"Downloaded object to {download_path}")

    # Handle extraction if requested
    if getattr(args, 'extract', False):
        if not is_archive(download_path):
            raise RuntimeError("--extract specified but file is not a supported archive type")

        # When --extract is used, args.path specifies the target extraction directory
        extract_dir = os.path.abspath(args.path)
        
        # Create fresh extraction directory
        if os.path.exists(extract_dir):
            shutil.rmtree(extract_dir)
        os.makedirs(extract_dir)

        try:
            print(f"Extracting archive to {extract_dir}...")
            extract_archive(download_path, extract_dir)
            print(f"Successfully extracted to {extract_dir}")
            # Clean up the downloaded archive since we've extracted it
            os.unlink(download_path)
        except Exception as e:
            # Clean up extraction directory on failure
            shutil.rmtree(extract_dir)
            raise

async def delete(args) -> None:
    """Delete an object.
    
    This action is irreversible and will remove the object and all its metadata.
    """
    assert args.id is not None
    # Ensure latest env/key is used
    try:
        runloop_api_client.cache_clear()
    except Exception:
        pass
    
    try:
        # Delete the object
        deleted_object = await runloop_api_client().objects.delete(args.id)
        print(f"Successfully deleted object {args.id}")
        
        # Print object details
        print(f"Deleted object details: {deleted_object.model_dump_json(indent=4)}")
    except Exception as e:
        raise RuntimeError(f"Failed to delete object: {str(e)}")

async def upload(args) -> None:
    """Upload a file as an object.
    
    The upload process consists of three steps:
    1. Create object and get upload URL
    2. Upload file content to the provided URL
    3. Mark upload as complete to transition from UPLOADING to READ_ONLY state
    """
    assert args.path is not None
    assert args.name is not None
    # Ensure latest env/key is used
    try:
        runloop_api_client.cache_clear()
    except Exception:
        pass

    # Check if file exists and is accessible
    try:
        file_path = os.path.abspath(args.path)
        file_size = os.path.getsize(file_path)
        with open(file_path, 'rb') as _:
            pass  # Just testing if we can open the file
    except FileNotFoundError:
        raise RuntimeError(f"File not found: {args.path}")
    except PermissionError:
        raise RuntimeError(f"Permission denied accessing file: {args.path}")
    except OSError as e:
        raise RuntimeError(f"Error accessing file: {args.path} - {str(e)}")

    try:
        # Step 1: Create the object (initial state: UPLOADING)
        # Detect content type from file extension if not provided
        content_type = args.content_type if hasattr(args, "content_type") and args.content_type else detect_content_type(args.path)
        print(f"Using content type: {content_type}")
        
        create_response = await runloop_api_client().objects.create(
            name=args.name,
            content_type=content_type
        )
        object_id = create_response.id
        print(f"Created object {object_id} in UPLOADING state")

        # Step 2: Upload the file using the provided upload URL
        upload_url = create_response.upload_url
        async with aiohttp.ClientSession() as session:
            # Open and upload the file with progress tracking
            with open(file_path, 'rb') as f:
                bytes_uploaded = 0
                print(f"Uploading {args.path} ({file_size} bytes)...", file=sys.stderr)

                # Create a progress tracking reader
                class ProgressReader(io.BufferedReader):
                    def __init__(self, file_path, total_size):
                        super().__init__(open(file_path, 'rb'))
                        self.total_size = total_size
                        self.bytes_read = 0

                    def read(self, size=-1):
                        chunk = super().read(size)
                        if chunk:
                            self.bytes_read += len(chunk)
                            progress = (self.bytes_read / self.total_size) * 100
                            print(f"\rProgress: {progress:.1f}%", end='', flush=True, file=sys.stderr)
                        return chunk

                # Create a progress reader (close the original file as we'll reopen it)
                f.close()
                reader = ProgressReader(file_path, file_size)

                try:
                        # Perform the upload (PUT request as required by server)
                        headers = {'Content-Length': str(file_size)}  # Required for some servers
                        response = await _retry_async(lambda: session.put(upload_url, data=reader, headers=headers))
                        if response.status not in (200, 201, 204):
                            try:
                                error_text = await response.text()
                            except Exception:
                                error_text = ""
                            try:
                                response.close()
                            finally:
                                pass
                            raise RuntimeError(f"Upload failed with status {response.status}: {error_text}")
                        print("\nUpload completed successfully.")
                finally:
                    reader.close()  # Ensure we close the file

        # Step 3: Complete the upload (transition to READ_ONLY state)
        try:
            await runloop_api_client().objects.complete(object_id)
            print(f"Object {object_id} ({args.name}) transitioned to READ_ONLY state")
        except Exception as e:
            print(f"\nWARNING: Failed to complete upload. Object {object_id} remains in UPLOADING state.")
            print("You can try completing it later using: rl objects complete {object_id}")
            raise RuntimeError(f"Failed to complete upload: {str(e)}")

    except aiohttp.ClientError as e:
        raise RuntimeError(f"Network error during upload: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"Error during upload: {str(e)}")
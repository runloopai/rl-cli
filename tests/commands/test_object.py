"""Tests for object commands."""

import json
import os
import tempfile
import zipfile
import tarfile
import zstandard
from unittest.mock import AsyncMock, patch, mock_open
import pytest
from rl_cli.main import run
from rl_cli.utils import runloop_api_client

class MockObject:
    def __init__(self, id="test-obj-id", name="test.txt", content_type="text/plain", state="READ_ONLY", size_bytes=1024):
        self.id = id
        self.name = name
        self.content_type = content_type
        self.state = state
        self.size_bytes = size_bytes
        self.upload_url = "https://example.com/upload"
        self.download_url = "https://example.com/download"

    def model_dump_json(self, indent=None):
        return json.dumps({
            "id": self.id,
            "name": self.name,
            "content_type": self.content_type,
            "state": self.state,
            "size_bytes": self.size_bytes,
            "upload_url": self.upload_url
        }, indent=indent)

@pytest.mark.asyncio
async def test_object_upload_success(capsys):
    """Test successful object upload."""
    # Create mock objects
    mock_object = MockObject()
    mock_response = AsyncMock()
    mock_response.status = 200

    # Create mock API client
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'

    # Create mock objects resource
    mock_objects = AsyncMock()
    mock_objects.create = AsyncMock(return_value=mock_object)
    mock_objects.complete = AsyncMock(return_value=mock_object)
    mock_api_client.objects = mock_objects

    # Create a temporary file
    with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp_file:
        temp_file.write("test content")
        temp_path = temp_file.name

    try:
        # Clear the cache to ensure we get a fresh client
        runloop_api_client.cache_clear()

        # Mock aiohttp ClientSession
        mock_session = AsyncMock()
        mock_session.__aenter__.return_value = AsyncMock()
        mock_session.__aenter__.return_value.put = AsyncMock(return_value=mock_response)

        with patch('aiohttp.ClientSession', return_value=mock_session), \
             patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
             patch('sys.argv', ['rl', 'object', 'upload', '--path', temp_path, '--name', 'test.txt']), \
             patch.dict('os.environ', {'RUNLOOP_API_KEY': 'test-api-key', 'RUNLOOP_ENV': 'dev'}):
            await run()

        # Check output
        captured = capsys.readouterr()
        assert "Created object test-obj-id in UPLOADING state" in captured.out
        assert "Upload completed successfully" in captured.out
        assert "transitioned to READ_ONLY state" in captured.out

        # Verify API calls
        mock_objects.create.assert_called_once()
        mock_objects.complete.assert_called_once_with("test-obj-id")

    finally:
        # Clean up temporary file
        os.unlink(temp_path)

@pytest.mark.asyncio
async def test_object_download_with_extract_zip(tmp_path, capsys):
    """Test downloading and extracting a zip file."""
    # Create a test zip file
    test_zip = tmp_path / "test.zip"
    with zipfile.ZipFile(test_zip, 'w') as zf:
        zf.writestr('test.txt', 'Hello World')
        zf.writestr('subdir/test2.txt', 'Hello Again')

    # Mock API client and responses
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'
    
    # Mock objects resource
    mock_objects = AsyncMock()
    mock_objects.download = AsyncMock(
        return_value=AsyncMock(download_url="https://example.com/download")
    )
    mock_objects.retrieve = AsyncMock()
    mock_objects.retrieve.return_value = MockObject(name="test.zip", content_type="application/zip")
    mock_api_client.objects = mock_objects

    # Mock aiohttp response
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.headers = {'content-length': str(os.path.getsize(test_zip))}
    
    # Create async iterator for file content
    async def mock_iter_chunked(chunk_size):
        with open(test_zip, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk
    
    mock_response.content.iter_chunked = mock_iter_chunked

    # Set up test environment
    extract_path = tmp_path / "extract_here"  # Directory to extract into

    with patch('aiohttp.ClientSession') as mock_session, \
         patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client):
        
        # Configure session mock
        session_instance = AsyncMock()
        session_instance.get.return_value = mock_response
        mock_session.return_value.__aenter__.return_value = session_instance

        # Run command
        with patch('sys.argv', [
            'rl', 'object', 'download',
            '--id', 'test-id',
            '--path', str(extract_path),
            '--extract'
        ]), patch.dict('os.environ', {
            'RUNLOOP_API_KEY': 'test-api-key',
            'RUNLOOP_ENV': 'dev'
        }):
            await run()

    # Verify output
    captured = capsys.readouterr()
    assert f"Extracting archive to {extract_path}" in captured.out
    assert f"Successfully extracted to {extract_path}" in captured.out

    # Verify extracted files
    assert (extract_path / 'test.txt').is_file()
    assert (extract_path / 'subdir' / 'test2.txt').is_file()
    with open(extract_path / 'test.txt') as f:
        assert f.read() == 'Hello World'

@pytest.mark.asyncio
async def test_object_download_with_extract_zst(tmp_path, capsys):
    """Test downloading and extracting a zst file."""
    # Create a test zst file
    test_file = tmp_path / "test.txt"
    test_file.write_text("Hello World")
    test_zst = tmp_path / "test.txt.zst"
    
    cctx = zstandard.ZstdCompressor()
    with open(test_file, 'rb') as src:
        with open(test_zst, 'wb') as dst:
            cctx.copy_stream(src, dst)

    # Mock API client and responses
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'
    
    # Mock objects resource
    mock_objects = AsyncMock()
    mock_objects.download = AsyncMock(
        return_value=AsyncMock(download_url="https://example.com/download")
    )
    mock_objects.retrieve = AsyncMock()
    mock_objects.retrieve.return_value = MockObject(name="test.txt.zst", content_type="application/zstd")
    mock_api_client.objects = mock_objects

    # Mock aiohttp response
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.headers = {'content-length': str(os.path.getsize(test_zst))}
    
    # Create async iterator for file content
    async def mock_iter_chunked(chunk_size):
        with open(test_zst, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk
    
    mock_response.content.iter_chunked = mock_iter_chunked

    # Set up test environment
    extract_path = tmp_path / "extract_here"  # Directory to extract into

    with patch('aiohttp.ClientSession') as mock_session, \
         patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client):
        
        # Configure session mock
        session_instance = AsyncMock()
        session_instance.get.return_value = mock_response
        mock_session.return_value.__aenter__.return_value = session_instance

        # Run command
        with patch('sys.argv', [
            'rl', 'object', 'download',
            '--id', 'test-id',
            '--path', str(extract_path),
            '--extract'
        ]), patch.dict('os.environ', {
            'RUNLOOP_API_KEY': 'test-api-key',
            'RUNLOOP_ENV': 'dev'
        }):
            await run()

    # Verify output
    captured = capsys.readouterr()
    assert f"Extracting archive to {extract_path}" in captured.out
    assert f"Successfully extracted to {extract_path}" in captured.out

    # Verify extracted file
    assert (extract_path / 'test.txt').is_file()
    with open(extract_path / 'test.txt') as f:
        assert f.read() == 'Hello World'

@pytest.mark.asyncio
async def test_object_download_with_extract_tar_zst(tmp_path, capsys):
    """Test downloading and extracting a tar.zst file."""
    # Create test files
    test_file = tmp_path / 'test.txt'
    test_file.write_text('Hello World')
    subdir = tmp_path / 'subdir'
    subdir.mkdir()
    test_file2 = subdir / 'test2.txt'
    test_file2.write_text('Hello Again')

    # Create tar archive
    tar_path = tmp_path / "test.tar"
    with tarfile.open(tar_path, 'w') as tf:
        tf.add(test_file, arcname='test.txt')
        tf.add(test_file2, arcname='subdir/test2.txt')

    # Compress with zstd
    test_tar_zst = tmp_path / "test.tar.zst"
    cctx = zstandard.ZstdCompressor()
    with open(tar_path, 'rb') as src:
        with open(test_tar_zst, 'wb') as dst:
            cctx.copy_stream(src, dst)

    # Mock API client and responses
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'
    
    # Mock objects resource
    mock_objects = AsyncMock()
    mock_objects.download = AsyncMock(
        return_value=AsyncMock(download_url="https://example.com/download")
    )
    mock_objects.retrieve = AsyncMock()
    mock_objects.retrieve.return_value = MockObject(name="test.tar.zst", content_type="application/x-tar+zstd")
    mock_api_client.objects = mock_objects

    # Mock aiohttp response
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.headers = {'content-length': str(os.path.getsize(test_tar_zst))}
    
    # Create async iterator for file content
    async def mock_iter_chunked(chunk_size):
        with open(test_tar_zst, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk
    
    mock_response.content.iter_chunked = mock_iter_chunked

    # Set up test environment
    extract_path = tmp_path / "extract_here"  # Directory to extract into

    with patch('aiohttp.ClientSession') as mock_session, \
         patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client):
        
        # Configure session mock
        session_instance = AsyncMock()
        session_instance.get.return_value = mock_response
        mock_session.return_value.__aenter__.return_value = session_instance

        # Run command
        with patch('sys.argv', [
            'rl', 'object', 'download',
            '--id', 'test-id',
            '--path', str(extract_path),
            '--extract'
        ]), patch.dict('os.environ', {
            'RUNLOOP_API_KEY': 'test-api-key',
            'RUNLOOP_ENV': 'dev'
        }):
            await run()

    # Verify output
    captured = capsys.readouterr()
    assert f"Extracting archive to {extract_path}" in captured.out
    assert f"Successfully extracted to {extract_path}" in captured.out

    # Verify extracted files
    assert (extract_path / 'test.txt').is_file()
    assert (extract_path / 'subdir' / 'test2.txt').is_file()
    with open(extract_path / 'test.txt') as f:
        assert f.read() == 'Hello World'

@pytest.mark.asyncio
async def test_object_download_with_extract_targz(tmp_path, capsys):
    """Test downloading and extracting a tar.gz file."""
    # Create test tar.gz with same structure
    test_targz = tmp_path / "test.tar.gz"
    with tarfile.open(test_targz, 'w:gz') as tf:
        # Add test files
        test_file = tmp_path / 'test.txt'
        test_file.write_text('Hello World')
        tf.add(test_file, arcname='test.txt')
        
        # Add subdirectory file
        subdir = tmp_path / 'subdir'
        subdir.mkdir()
        test_file2 = subdir / 'test2.txt'
        test_file2.write_text('Hello Again')
        tf.add(test_file2, arcname='subdir/test2.txt')

    # Mock API client and responses
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'
    
    # Mock objects resource
    mock_objects = AsyncMock()
    mock_objects.download = AsyncMock(
        return_value=AsyncMock(download_url="https://example.com/download")
    )
    mock_objects.retrieve = AsyncMock()
    mock_objects.retrieve.return_value = MockObject(name="test.tar.gz", content_type="application/x-tar+gzip")
    mock_api_client.objects = mock_objects

    # Mock aiohttp response
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.headers = {'content-length': str(os.path.getsize(test_targz))}
    
    # Create async iterator for file content
    async def mock_iter_chunked(chunk_size):
        with open(test_targz, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk
    
    mock_response.content.iter_chunked = mock_iter_chunked

    # Set up test environment
    extract_path = tmp_path / "extract_here"  # Directory to extract into

    with patch('aiohttp.ClientSession') as mock_session, \
         patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client):
        
        # Configure session mock
        session_instance = AsyncMock()
        session_instance.get.return_value = mock_response
        mock_session.return_value.__aenter__.return_value = session_instance

        # Run command
        with patch('sys.argv', [
            'rl', 'object', 'download',
            '--id', 'test-id',
            '--path', str(extract_path),
            '--extract'
        ]), patch.dict('os.environ', {
            'RUNLOOP_API_KEY': 'test-api-key',
            'RUNLOOP_ENV': 'dev'
        }):
            await run()

    # Verify output
    captured = capsys.readouterr()
    assert f"Extracting archive to {extract_path}" in captured.out
    assert f"Successfully extracted to {extract_path}" in captured.out

    # Verify extracted files
    assert (extract_path / 'test.txt').is_file()
    assert (extract_path / 'subdir' / 'test2.txt').is_file()
    with open(extract_path / 'test.txt') as f:
        assert f.read() == 'Hello World'

@pytest.mark.asyncio
async def test_object_download_extract_unsupported(tmp_path, capsys):
    """Test attempting to extract an unsupported file type."""
    # Mock API client and responses
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'
    
    # Mock objects resource
    mock_objects = AsyncMock()
    mock_objects.download = AsyncMock(
        return_value=AsyncMock(download_url="https://example.com/download")
    )
    mock_objects.retrieve = AsyncMock()
    mock_objects.retrieve.return_value = MockObject(name="test.txt", content_type="text/plain")
    mock_api_client.objects = mock_objects

    # Create a test file
    test_file = tmp_path / "test.txt"
    test_file.write_text("Hello World")

    # Mock aiohttp response
    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.headers = {'content-length': str(os.path.getsize(test_file))}
    
    # Create async iterator for file content
    async def mock_iter_chunked(chunk_size):
        with open(test_file, 'rb') as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                yield chunk
    
    mock_response.content.iter_chunked = mock_iter_chunked

    # Set up test environment
    target_path = tmp_path / "download.txt"

    with patch('aiohttp.ClientSession') as mock_session, \
         patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client):
        
        # Configure session mock
        session_instance = AsyncMock()
        session_instance.get.return_value = mock_response
        mock_session.return_value.__aenter__.return_value = session_instance

        # Run command
        with patch('sys.argv', [
            'rl', 'object', 'download',
            '--id', 'test-id',
            '--path', str(target_path),
            '--extract'
        ]), patch.dict('os.environ', {
            'RUNLOOP_API_KEY': 'test-api-key',
            'RUNLOOP_ENV': 'dev'
        }):
            with pytest.raises(RuntimeError) as excinfo:
                await run()

    # Verify error raised for unsupported extraction
    assert "not a supported archive type" in str(excinfo.value)

@pytest.mark.asyncio
async def test_object_upload_file_not_found(capsys):
    """Test object upload with non-existent file."""
    # Create mock API client
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('sys.argv', ['rl', 'object', 'upload', '--path', '/nonexistent/file.txt', '--name', 'test.txt']), \
         patch.dict('os.environ', {'RUNLOOP_API_KEY': 'test-api-key', 'RUNLOOP_ENV': 'dev'}), \
         pytest.raises(RuntimeError) as exc_info:
        await run()

    assert "File not found" in str(exc_info.value)

@pytest.mark.asyncio
async def test_object_upload_content_type_detection(capsys):
    """Test content type detection during upload."""
    # Create mock objects
    mock_object = MockObject()
    mock_response = AsyncMock()
    mock_response.status = 200

    # Create mock API client
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'

    # Create mock objects resource
    mock_objects = AsyncMock()
    mock_objects.create = AsyncMock(return_value=mock_object)
    mock_objects.complete = AsyncMock(return_value=mock_object)
    mock_api_client.objects = mock_objects

    # Test different file extensions
    test_cases = [
        ('test.json', 'application/json'),
        ('test.txt', 'text/plain'),
        ('test.md', 'text/plain'),
        ('test.png', 'image/png'),
        ('test.unknown', 'application/octet-stream'),
        ('test.zst', 'application/octet-stream'),
        ('test.tar.zst', 'application/octet-stream'),
    ]

    for filename, expected_type in test_cases:
        # Clear the cache to ensure we get a fresh client
        runloop_api_client.cache_clear()

        # Create a temporary file
        with tempfile.NamedTemporaryFile(mode='wb', delete=False) as temp_file:
            temp_file.write(b"test content")
            temp_path = temp_file.name

        try:
            # Mock aiohttp ClientSession
            mock_session = AsyncMock()
            mock_session.__aenter__.return_value = AsyncMock()
            mock_session.__aenter__.return_value.put = AsyncMock(return_value=mock_response)

            # Rename the temp file to have the correct extension
            new_path = temp_path + filename
            os.rename(temp_path, new_path)

            with patch('aiohttp.ClientSession', return_value=mock_session), \
                 patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
                 patch('sys.argv', ['rl', 'object', 'upload', '--path', new_path, '--name', filename]), \
                 patch.dict('os.environ', {'RUNLOOP_API_KEY': 'test-api-key', 'RUNLOOP_ENV': 'dev'}):
                await run()

            # Verify content type
            mock_objects.create.assert_called_with(name=filename, content_type=expected_type)
            mock_objects.create.reset_mock()

            # Clean up the renamed file
            os.unlink(new_path)

        except:
            # Clean up files in case of error
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            if os.path.exists(new_path):
                os.unlink(new_path)
            raise

@pytest.mark.asyncio
async def test_object_delete_success(capsys):
    """Test successful object deletion."""
    # Create mock object
    mock_object = MockObject()

    # Create mock API client
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'

    # Create mock objects resource
    mock_objects = AsyncMock()
    mock_objects.delete = AsyncMock(return_value=mock_object)
    mock_api_client.objects = mock_objects

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('sys.argv', ['rl', 'object', 'delete', '--id', 'test-obj-id']), \
         patch.dict('os.environ', {'RUNLOOP_API_KEY': 'test-api-key', 'RUNLOOP_ENV': 'dev'}):
        await run()

    # Check output
    captured = capsys.readouterr()
    assert "Successfully deleted object test-obj-id" in captured.out
    assert "Deleted object details" in captured.out

    # Verify API call
    mock_objects.delete.assert_called_once_with("test-obj-id")

@pytest.mark.asyncio
async def test_object_delete_not_found(capsys):
    """Test object deletion with non-existent ID."""
    # Create mock API client
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'

    # Create mock objects resource with error
    mock_objects = AsyncMock()
    mock_objects.delete = AsyncMock(side_effect=Exception("Object not found"))
    mock_api_client.objects = mock_objects

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('sys.argv', ['rl', 'object', 'delete', '--id', 'nonexistent-id']), \
         patch.dict('os.environ', {'RUNLOOP_API_KEY': 'test-api-key', 'RUNLOOP_ENV': 'dev'}), \
         pytest.raises(RuntimeError) as exc_info:
        await run()

    assert "Failed to delete object" in str(exc_info.value)
    assert "Object not found" in str(exc_info.value)
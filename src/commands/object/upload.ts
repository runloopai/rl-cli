/**
 * Upload object command
 */

import { lstat, readFile, readdir, readlink, stat } from "fs/promises";
import { dirname, extname, relative, resolve, sep } from "path";
import { createGzip } from "zlib";
import { pipeline } from "stream/promises";
import tar from "tar-stream";
import type { Headers } from "tar-stream";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { parseMetadata } from "../../utils/metadata.js";
import { processUtils } from "../../utils/processUtils.js";

interface UploadObjectOptions {
  paths: string[];
  name: string;
  contentType?: string;
  public?: boolean;
  metadata?: string[];
  output?: string;
}

type ContentType = "binary" | "text" | "unspecified" | "gzip" | "tar" | "tgz";

const CONTENT_TYPE_MAP: Record<string, ContentType> = {
  ".txt": "text",
  ".html": "text",
  ".css": "text",
  ".js": "text",
  ".json": "text",
  ".yaml": "text",
  ".yml": "text",
  ".md": "text",
  ".gz": "gzip",
  ".tar": "tar",
  ".tgz": "tgz",
  ".tar.gz": "tgz",
};

interface TarEntry {
  header: Headers;
  data?: Buffer;
}

/**
 * Recursively collect all files, directories, and symlinks under the given
 * paths into tar entries. Normalizes permissions: uid/gid 1000, directories
 * and executable files get mode 0o755, everything else gets 0o644. Preserves
 * mtime. Symlinks are stored as symlink entries with their target path.
 *
 * Entry names are always relative to `archiveRoot` and never contain leading
 * `../` segments, preventing path traversal in the generated archive.
 */
async function collectEntries(
  paths: string[],
  archiveRoot: string,
  precomputedStats?: Map<string, Awaited<ReturnType<typeof lstat>>>,
): Promise<TarEntry[]> {
  const entries: TarEntry[] = [];

  for (const p of paths) {
    const absPath = resolve(p);
    const relPath = relative(archiveRoot, absPath);

    if (relPath.startsWith("..")) {
      throw new Error(
        `Path "${absPath}" is outside the archive root "${archiveRoot}". All paths must share a common ancestor directory.`,
      );
    }

    let stats = precomputedStats?.get(absPath);
    if (!stats) {
      try {
        stats = await lstat(absPath);
      } catch (err) {
        throw new Error(`Cannot read path: ${relPath}`, { cause: err });
      }
    }

    if (stats.isSymbolicLink()) {
      const linkTarget = await readlink(absPath);
      entries.push({
        header: {
          name: relPath,
          type: "symlink",
          linkname: linkTarget,
          mode: 0o777,
          uid: 1000,
          gid: 1000,
          mtime: stats.mtime,
        },
      });
    } else if (stats.isDirectory()) {
      entries.push({
        header: {
          name: relPath.endsWith("/") ? relPath : relPath + "/",
          type: "directory",
          mode: 0o755,
          uid: 1000,
          gid: 1000,
          mtime: stats.mtime,
        },
      });
      const children = (await readdir(absPath)).sort();
      const childPaths = children.map((c) => resolve(absPath, c));
      if (childPaths.length > 0) {
        entries.push(...(await collectEntries(childPaths, archiveRoot)));
      }
    } else {
      const isExecutable = (Number(stats.mode) & 0o111) !== 0;
      let data;
      try {
        data = await readFile(absPath);
      } catch (err) {
        throw new Error(`Cannot read file: ${relPath}`, { cause: err });
      }
      entries.push({
        header: {
          name: relPath,
          type: "file",
          mode: isExecutable ? 0o755 : 0o644,
          uid: 1000,
          gid: 1000,
          size: data.length,
          mtime: stats.mtime,
        },
        data,
      });
    }
  }

  return entries;
}

/**
 * Compute the deepest common directory for a list of absolute paths.
 * Used as the archive root so entry names are always relative and safe.
 */
function commonAncestor(absPaths: string[]): string {
  if (absPaths.length === 0) return process.cwd();
  if (absPaths.length === 1) return dirname(absPaths[0]);
  const parts = absPaths.map((p) => p.split(sep));
  const common: string[] = [];
  for (let i = 0; i < parts[0].length; i++) {
    const segment = parts[0][i];
    if (parts.every((p) => p[i] === segment)) {
      common.push(segment);
    } else {
      break;
    }
  }
  return common.join(sep) || sep;
}

/**
 * Create a tar (or tgz) archive as a Buffer from the given filesystem paths.
 *
 * Walks directories recursively and normalizes all entries to uid/gid 1000,
 * mode 644 (non-executable files) or 755 (executable files and directories).
 * Entry names are relative to the common ancestor of the provided paths.
 */
export async function createTarBuffer(
  paths: string[],
  gzip: boolean,
  precomputedStats?: Map<string, Awaited<ReturnType<typeof lstat>>>,
): Promise<Buffer> {
  const absPaths = paths.map((p) => resolve(p));
  const unique = new Set(absPaths);
  if (unique.size < absPaths.length) {
    const seen = new Set<string>();
    const dupes = absPaths.filter((p) =>
      seen.has(p) ? true : (seen.add(p), false),
    );
    throw new Error(`Duplicate paths: ${[...new Set(dupes)].join(", ")}`);
  }
  const archiveRoot = commonAncestor(absPaths);
  const entries = await collectEntries(paths, archiveRoot, precomputedStats);

  const pack = tar.pack();
  for (const entry of entries) {
    if (entry.data) {
      pack.entry(entry.header, entry.data);
    } else {
      pack.entry(entry.header);
    }
  }
  pack.finalize();

  if (gzip) {
    const gz = createGzip();
    const chunks: Buffer[] = [];
    gz.on("data", (chunk: Buffer) => chunks.push(chunk));
    await pipeline(pack, gz);
    return Buffer.concat(chunks);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of pack) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readStdinBuffer(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of processUtils.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function uploadObject(options: UploadObjectOptions) {
  try {
    const client = getClient();
    const { paths, name, contentType, output: outputFormat } = options;

    if (paths.length === 0) {
      if (!processUtils.stdin.isTTY) {
        // Piped stdin detected — normalize to explicit stdin path below
        paths.push("-");
      } else {
        // Interactive terminal: print pre-signed upload URL
        if (!name) {
          outputError("--name is required when no paths are provided");
        }
        const resolvedContentType: ContentType =
          (contentType as ContentType) || "unspecified";

        const createResponse = await client.objects.create({
          name,
          content_type: resolvedContentType,
        });

        if (!createResponse.upload_url) {
          outputError("API did not return an upload URL");
        }

        const result = {
          id: createResponse.id,
          name,
          contentType: resolvedContentType,
          uploadUrl: createResponse.upload_url,
        };

        if (!outputFormat || outputFormat === "text") {
          console.log(createResponse.upload_url);
        } else {
          output(result, { format: outputFormat, defaultFormat: "json" });
        }
        return;
      }
    }

    const hasStdin = paths.includes("-");
    const isStdin = paths.length === 1 && hasStdin;

    // stdin cannot be mixed with other paths (e.g. `upload - file1.txt`)
    if (hasStdin && !isStdin) {
      outputError(
        "Cannot mix stdin (-) with other paths. Use - alone or provide only file/directory paths.",
      );
    }

    if (isStdin) {
      if (!name) {
        outputError("--name is required when uploading from stdin");
      }
      if (!contentType) {
        outputError("--content-type is required when uploading from stdin");
      }
    }

    let fileBuffer: Buffer;
    let detectedContentType: ContentType;
    let fileSize: number;

    if (isStdin) {
      fileBuffer = await readStdinBuffer();
      fileSize = fileBuffer.length;
      detectedContentType = contentType as ContentType;
    } else {
      const statsMap = new Map<string, Awaited<ReturnType<typeof lstat>>>();
      for (const p of paths) {
        try {
          const s = await lstat(p);
          statsMap.set(resolve(p), s);
        } catch {
          outputError(`Path does not exist: ${p}`);
          return;
        }
      }

      const isTarType = contentType === "tar" || contentType === "tgz";
      const isSinglePath = paths.length === 1;
      const firstStats = isSinglePath
        ? statsMap.get(resolve(paths[0]))!
        : undefined;
      const singleIsDir =
        isSinglePath &&
        (firstStats!.isDirectory() ||
          (firstStats!.isSymbolicLink() && (await stat(paths[0])).isDirectory()));

      // Multi-path requires tar/tgz content type
      if (paths.length > 1 && !isTarType) {
        outputError(
          "Multiple paths require --content-type tar or --content-type tgz",
        );
        return;
      }

      // Directory without tar/tgz type
      if (singleIsDir && !isTarType) {
        outputError(
          "Cannot upload a directory directly. Use --content-type tar or --content-type tgz to create an archive.",
        );
        return;
      }

      const shouldCreateArchive =
        isTarType && (paths.length > 1 || singleIsDir);

      if (shouldCreateArchive) {
        const gzip = contentType === "tgz";
        fileBuffer = await createTarBuffer(paths, gzip, statsMap);
        detectedContentType = contentType as ContentType;
        fileSize = fileBuffer.length;
      } else {
        // Single file upload (existing behavior)
        const filePath = paths[0];
        fileBuffer = await readFile(filePath);
        fileSize = fileBuffer.length;

        detectedContentType = contentType as ContentType;
        if (!detectedContentType) {
          const ext = extname(filePath).toLowerCase();
          detectedContentType = CONTENT_TYPE_MAP[ext] || "unspecified";
        }
      }
    }

    // Step 1: Create the object
    const createParams: {
      name: string;
      content_type: ContentType;
      metadata?: Record<string, string>;
    } = {
      name,
      content_type: detectedContentType,
    };
    if (options.metadata) {
      createParams.metadata = parseMetadata(options.metadata);
    }
    const createResponse = await client.objects.create(createParams);

    // Step 2: Upload the file
    const uploadResponse = await fetch(createResponse.upload_url!, {
      method: "PUT",
      body: fileBuffer,
      headers: {
        "Content-Length": fileBuffer.length.toString(),
      },
    });

    if (!uploadResponse.ok) {
      outputError(`Upload failed: HTTP ${uploadResponse.status}`);
    }

    // Step 3: Complete the upload
    await client.objects.complete(createResponse.id);

    const result = {
      id: createResponse.id,
      name,
      contentType: detectedContentType,
      size: fileSize,
    };

    // Default: just output the ID for easy scripting
    if (!outputFormat || outputFormat === "text") {
      console.log(result.id);
    } else {
      output(result, { format: outputFormat, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to upload object", error);
  }
}

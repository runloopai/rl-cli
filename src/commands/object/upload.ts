/**
 * Upload object command
 */

import { lstat, readFile, readdir, stat } from "fs/promises";
import { extname, relative, resolve } from "path";
import { createTar, createTarGzip } from "nanotar";
import type { TarFileInput } from "nanotar";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface UploadObjectOptions {
  paths: string[];
  name: string;
  contentType?: string;
  public?: boolean;
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

/**
 * Recursively collect all files and directories under the given paths into
 * nanotar entries. Normalizes permissions: uid/gid 1000, directories and
 * executable files get mode 755, everything else gets 644. Preserves mtime.
 */
async function collectEntries(
  paths: string[],
  cwd: string,
): Promise<TarFileInput[]> {
  const entries: TarFileInput[] = [];

  for (const p of paths) {
    const absPath = resolve(p);
    const relPath = relative(cwd, absPath);

    let stats;
    try {
      stats = await lstat(absPath);
    } catch {
      throw new Error(`Cannot read path: ${relPath}`);
    }

    if (stats.isSymbolicLink()) {
      console.error(`Skipping symlink: ${relPath}`);
      continue;
    }

    if (stats.isDirectory()) {
      entries.push({
        name: relPath.endsWith("/") ? relPath : relPath + "/",
        attrs: {
          mode: "755",
          uid: 1000,
          gid: 1000,
          mtime: stats.mtimeMs,
        },
      });
      const children = await readdir(absPath);
      const childPaths = children.map((c) => resolve(absPath, c));
      if (childPaths.length > 0) {
        entries.push(...(await collectEntries(childPaths, cwd)));
      }
    } else {
      const isExecutable = (stats.mode & 0o111) !== 0;
      let data;
      try {
        data = await readFile(absPath);
      } catch {
        throw new Error(`Cannot read file: ${relPath}`);
      }
      entries.push({
        name: relPath,
        data,
        attrs: {
          mode: isExecutable ? "755" : "644",
          uid: 1000,
          gid: 1000,
          mtime: stats.mtimeMs,
        },
      });
    }
  }

  return entries;
}

/**
 * Create a tar (or tgz) archive as a Buffer from the given filesystem paths.
 *
 * Walks directories recursively and normalizes all entries to uid/gid 1000,
 * mode 644 (non-executable files) or 755 (executable files and directories).
 */
export async function createTarBuffer(
  paths: string[],
  gzip: boolean,
): Promise<Buffer> {
  const cwd = process.cwd();
  const entries = await collectEntries(paths, cwd);

  if (gzip) {
    const data = await createTarGzip(entries);
    return Buffer.from(data);
  }

  const data = createTar(entries);
  return Buffer.from(data);
}

export async function uploadObject(options: UploadObjectOptions) {
  try {
    const client = getClient();
    const { paths, name, contentType, output: outputFormat } = options;

    if (paths.length === 0) {
      outputError("At least one path is required");
      return;
    }

    // Validate all paths exist
    const statsMap = new Map<string, Awaited<ReturnType<typeof stat>>>();
    for (const p of paths) {
      try {
        statsMap.set(p, await stat(p));
      } catch {
        outputError(`Path does not exist: ${p}`);
        return;
      }
    }

    const isTarType = contentType === "tar" || contentType === "tgz";
    const singlePath = paths.length === 1;
    const singleIsDir = singlePath && statsMap.get(paths[0])!.isDirectory();

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

    let fileBuffer: Buffer;
    let detectedContentType: ContentType;
    let fileSize: number;

    const shouldCreateArchive = isTarType && (paths.length > 1 || singleIsDir);

    if (shouldCreateArchive) {
      const gzip = contentType === "tgz";
      fileBuffer = await createTarBuffer(paths, gzip);
      detectedContentType = contentType as ContentType;
      fileSize = fileBuffer.length;
    } else {
      // Single file upload (existing behavior)
      const singlePath = paths[0];
      const stats = statsMap.get(singlePath)!;
      fileBuffer = await readFile(singlePath);
      fileSize = Number(stats.size);

      detectedContentType = contentType as ContentType;
      if (!detectedContentType) {
        const ext = extname(singlePath).toLowerCase();
        detectedContentType = CONTENT_TYPE_MAP[ext] || "unspecified";
      }
    }

    // Step 1: Create the object
    const createResponse = await client.objects.create({
      name,
      content_type: detectedContentType,
    });

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

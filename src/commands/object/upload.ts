/**
 * Upload object command
 */

import { lstat, readFile, readdir } from "fs/promises";
import { dirname, extname, relative, resolve, sep } from "path";
import { createTar, createTarGzip } from "nanotar";
import type { TarFileInput } from "nanotar";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { processUtils } from "../../utils/processUtils.js";

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
 *
 * Entry names are always relative to `archiveRoot` and never contain leading
 * `../` segments, preventing path traversal in the generated archive.
 */
async function collectEntries(
  paths: string[],
  archiveRoot: string,
  precomputedStats?: Map<string, Awaited<ReturnType<typeof lstat>>>,
): Promise<TarFileInput[]> {
  const entries: TarFileInput[] = [];

  for (const p of paths) {
    const absPath = resolve(p);
    let relPath = relative(archiveRoot, absPath);

    // Guard against path traversal: entry names must not escape the archive root
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
      throw new Error(
        `Path is a symlink: ${relPath}. Resolve the symlink or pass the target path directly.`,
      );
    }

    if (stats.isDirectory()) {
      entries.push({
        name: relPath.endsWith("/") ? relPath : relPath + "/",
        attrs: {
          mode: "755",
          uid: 1000,
          gid: 1000,
          // nanotar expects mtime in milliseconds and converts to seconds internally
          mtime: Number(stats.mtimeMs),
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
        name: relPath,
        data,
        attrs: {
          mode: isExecutable ? "755" : "644",
          uid: 1000,
          gid: 1000,
          // nanotar expects mtime in milliseconds and converts to seconds internally
          mtime: Number(stats.mtimeMs),
        },
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
  const archiveRoot = commonAncestor(absPaths);
  const entries = await collectEntries(paths, archiveRoot, precomputedStats);

  if (gzip) {
    const data = await createTarGzip(entries);
    return Buffer.from(data);
  }

  const data = createTar(entries);
  return Buffer.from(data);
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
    const { paths: rawPaths, name, contentType, output: outputFormat } = options;
    const paths = [...rawPaths];

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
      // Validate all paths exist (use lstat to match collectEntries and detect symlinks)
      // Key by resolved absolute path so collectEntries can reuse stats
      const statsMap = new Map<string, Awaited<ReturnType<typeof lstat>>>();
      for (const p of paths) {
        try {
          const s = await lstat(p);
          if (s.isSymbolicLink()) {
            outputError(
              `Path is a symlink: ${p}. Resolve the symlink or pass the target path directly.`,
            );
            return;
          }
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
      const singleIsDir = isSinglePath && firstStats!.isDirectory();

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
    const createResponse = await client.objects.create({
      name,
      content_type: detectedContentType,
      ...(options.public ? { is_public: true } : {}),
    } as any);

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

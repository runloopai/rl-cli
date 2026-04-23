/**
 * Upload object command
 */

import { readFile, stat, unlink } from "fs/promises";
import { tmpdir } from "os";
import { extname, join, relative, resolve } from "path";
import { randomUUID } from "crypto";
import * as tar from "tar";
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

export async function createTarBuffer(
  paths: string[],
  gzip: boolean,
): Promise<Buffer> {
  const cwd = process.cwd();
  const relativePaths = paths.map((p) => relative(cwd, resolve(p)));

  const tmpFile = join(
    tmpdir(),
    `rl-upload-${randomUUID()}.${gzip ? "tgz" : "tar"}`,
  );

  await tar.create(
    {
      file: tmpFile,
      gzip,
      cwd,
    },
    relativePaths,
  );

  const buffer = await readFile(tmpFile);
  await unlink(tmpFile);
  return buffer;
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

/**
 * Upload object command
 */

import { readFile, stat } from "fs/promises";
import { extname } from "path";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface UploadObjectOptions {
  path: string;
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

export async function uploadObject(options: UploadObjectOptions) {
  try {
    const client = getClient();

    // Check if file exists and get stats
    const stats = await stat(options.path);
    const fileBuffer = await readFile(options.path);

    // Auto-detect content type if not provided
    let detectedContentType: ContentType = options.contentType as ContentType;
    if (!detectedContentType) {
      const ext = extname(options.path).toLowerCase();
      detectedContentType = CONTENT_TYPE_MAP[ext] || "unspecified";
    }

    // Step 1: Create the object
    const createResponse = await client.objects.create({
      name: options.name,
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
      name: options.name,
      contentType: detectedContentType,
      size: stats.size,
    };

    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      console.log(result.id);
    } else {
      output(result, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to upload object", error);
  }
}


/**
 * Upload file to devbox command
 */

import { createReadStream } from "fs";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface UploadOptions {
  path?: string;
  output?: string;
}

export async function uploadFile(
  id: string,
  file: string,
  options: UploadOptions = {},
) {
  try {
    const client = getClient();
    const fileStream = createReadStream(file);
    const filename = file.split("/").pop() || "uploaded-file";

    await client.devboxes.uploadFile(id, {
      path: options.path || filename,
      file: fileStream,
    });

    const result = {
      file,
      target: options.path || filename,
      devboxId: id,
    };

    // Default: just output the target path for easy scripting
    if (!options.output || options.output === "text") {
      console.log(options.path || filename);
    } else {
      output(result, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to upload file", error);
  }
}

/**
 * Download file from devbox command
 */

import { writeFileSync } from "fs";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface DownloadOptions {
  filePath?: string;
  outputPath?: string;
  output?: string;
}

export async function downloadFile(
  devboxId: string,
  options: DownloadOptions = {},
) {
  if (!options.filePath) {
    outputError("--file-path is required");
  }
  if (!options.outputPath) {
    outputError("--output-path is required");
  }

  try {
    const client = getClient();
    const result = await client.devboxes.downloadFile(devboxId, {
      path: options.filePath!,
    });

    const buffer = Buffer.from(await result.arrayBuffer());
    writeFileSync(options.outputPath!, buffer);

    // Default: just output the local path for easy scripting
    if (!options.output || options.output === "text") {
      console.log(options.outputPath);
    } else {
      output(
        {
          remote: options.filePath,
          local: options.outputPath,
        },
        { format: options.output, defaultFormat: "json" },
      );
    }
  } catch (error) {
    outputError("Failed to download file", error);
  }
}

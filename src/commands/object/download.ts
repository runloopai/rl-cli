/**
 * Download object command
 */

import { writeFile } from "fs/promises";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface DownloadObjectOptions {
  id: string;
  path: string;
  extract?: boolean;
  durationSeconds?: number;
  output?: string;
}

export async function downloadObject(options: DownloadObjectOptions) {
  try {
    const client = getClient();

    // Get the download URL
    const downloadUrlResponse = await client.objects.download(options.id, {
      duration_seconds: options.durationSeconds || 3600,
    });

    // Download the file
    const response = await fetch(downloadUrlResponse.download_url);
    if (!response.ok) {
      outputError(`Download failed: HTTP ${response.status}`);
    }

    // Save the file
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(options.path, buffer);

    // TODO: Handle extraction if requested (options.extract)

    const result = {
      id: options.id,
      path: options.path,
      extracted: options.extract || false,
    };

    // Default: just output the local path for easy scripting
    if (!options.output || options.output === "text") {
      console.log(options.path);
    } else {
      output(result, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to download object", error);
  }
}

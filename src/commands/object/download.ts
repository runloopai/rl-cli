/**
 * Download object command
 */

import { writeFile } from "fs/promises";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { getDefaultDownloadPath } from "../../utils/downloadPath.js";
import { processUtils } from "../../utils/processUtils.js";

interface DownloadObjectOptions {
  id: string;
  path?: string;
  extract?: boolean;
  durationSeconds?: number;
  output?: string;
}

/** Content types that produce non-text (binary) output */
const BINARY_CONTENT_TYPES = new Set([
  "binary",
  "gzip",
  "tar",
  "tgz",
  "unspecified",
]);

export async function downloadObject(options: DownloadObjectOptions) {
  try {
    const client = getClient();
    const isStdout = options.path === "-";

    // Resolve the download path when not provided or when writing to stdout
    // (stdout mode still needs content_type for the TTY binary warning)
    let resolvedPath = options.path;
    let contentType: string | undefined;
    if (!resolvedPath || isStdout) {
      const obj = await client.objects.retrieve(options.id);
      contentType = obj.content_type;
      if (!resolvedPath) {
        resolvedPath = getDefaultDownloadPath(
          obj.name,
          obj.id,
          obj.content_type,
        );
      }
    }

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

    if (isStdout) {
      // Warn if writing binary data to a terminal
      if (
        processUtils.stdout.isTTY &&
        contentType &&
        BINARY_CONTENT_TYPES.has(contentType)
      ) {
        processUtils.stderr.write(
          "Warning: writing binary data to terminal; pipe to a file or command instead\n",
        );
      }
      processUtils.stdout.write(buffer);
    } else {
      await writeFile(resolvedPath, buffer);
    }

    // TODO: Handle extraction if requested (options.extract)

    const result = {
      id: options.id,
      path: isStdout ? "-" : resolvedPath,
      extracted: options.extract || false,
    };

    if (isStdout) {
      // Structured output goes to stderr to avoid mixing with data (always JSON)
      if (options.output && options.output !== "text") {
        processUtils.stderr.write(JSON.stringify(result, null, 2) + "\n");
      }
    } else if (!options.output || options.output === "text") {
      // Default: just output the local path for easy scripting
      console.log(resolvedPath);
    } else {
      output(result, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to download object", error);
  }
}

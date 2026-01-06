/**
 * Read file from devbox command (using API)
 */

import { writeFile } from "fs/promises";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface ReadOptions {
  remote?: string;
  outputPath?: string;
  output?: string;
}

export async function readFile(devboxId: string, options: ReadOptions = {}) {
  if (!options.remote) {
    outputError("--remote is required");
  }
  if (!options.outputPath) {
    outputError("--output-path is required");
  }

  try {
    const client = getClient();
    const contents = await client.devboxes.readFileContents(devboxId, {
      file_path: options.remote!,
    });

    await writeFile(options.outputPath!, contents);

    // Default: just output the local path for easy scripting
    if (!options.output || options.output === "text") {
      console.log(options.outputPath);
    } else {
      output(
        {
          remote: options.remote,
          local: options.outputPath,
          size: contents.length,
        },
        { format: options.output, defaultFormat: "json" },
      );
    }
  } catch (error) {
    outputError("Failed to read file", error);
  }
}

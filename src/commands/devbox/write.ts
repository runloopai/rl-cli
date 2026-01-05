/**
 * Write file to devbox command (using API)
 */

import { readFile } from "fs/promises";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface WriteOptions {
  input?: string;
  remote?: string;
  output?: string;
}

export async function writeFile(devboxId: string, options: WriteOptions = {}) {
  if (!options.input) {
    outputError("--input is required");
  }
  if (!options.remote) {
    outputError("--remote is required");
  }
  
  try {
    const client = getClient();
    const contents = await readFile(options.input!, "utf-8");
    
    await client.devboxes.writeFileContents(devboxId, {
      file_path: options.remote!,
      contents,
    });
    
    // Default: just output the remote path for easy scripting
    if (!options.output || options.output === "text") {
      console.log(options.remote);
    } else {
      output({
        local: options.input,
        remote: options.remote,
        size: contents.length,
      }, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to write file", error);
  }
}

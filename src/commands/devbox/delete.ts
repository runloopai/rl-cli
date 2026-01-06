/**
 * Delete (shutdown) devbox command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface DeleteOptions {
  output?: string;
}

export async function deleteDevbox(id: string, options: DeleteOptions = {}) {
  try {
    const client = getClient();
    await client.devboxes.shutdown(id);

    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      console.log(id);
    } else {
      output(
        { id, status: "shutdown" },
        { format: options.output, defaultFormat: "json" },
      );
    }
  } catch (error) {
    outputError("Failed to shutdown devbox", error);
  }
}

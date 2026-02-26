/**
 * Delete MCP config command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface DeleteOptions {
  output?: string;
}

export async function deleteMcpConfig(
  id: string,
  options: DeleteOptions = {},
) {
  try {
    const client = getClient();

    await client.mcpConfigs.delete(id);

    if (!options.output || options.output === "text") {
      console.log(id);
    } else {
      output(
        { id, status: "deleted" },
        { format: options.output, defaultFormat: "json" },
      );
    }
  } catch (error) {
    outputError("Failed to delete MCP config", error);
  }
}

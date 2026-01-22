/**
 * Delete network policy command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface DeleteOptions {
  output?: string;
}

export async function deleteNetworkPolicy(
  id: string,
  options: DeleteOptions = {},
) {
  try {
    const client = getClient();
    await client.networkPolicies.delete(id);

    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      console.log(id);
    } else {
      output(
        { id, status: "deleted" },
        { format: options.output, defaultFormat: "json" },
      );
    }
  } catch (error) {
    outputError("Failed to delete network policy", error);
  }
}

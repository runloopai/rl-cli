/**
 * Delete blueprint command
 * Supports both blueprint ID (bpt_...) and name
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface DeleteOptions {
  output?: string;
}

export async function deleteBlueprint(
  nameOrId: string,
  options: DeleteOptions = {},
) {
  try {
    const client = getClient();

    let blueprintId = nameOrId;

    // If it's not an ID, resolve by name
    if (!nameOrId.startsWith("bpt_")) {
      const result = await client.blueprints.list({ name: nameOrId });
      const blueprints = result.blueprints || [];

      if (blueprints.length === 0) {
        outputError(
          `Blueprint not found: ${nameOrId}`,
          new Error("Blueprint not found"),
        );
        return;
      }

      // Use exact match if available, otherwise first result
      const blueprint =
        blueprints.find((b) => b.name === nameOrId) || blueprints[0];
      blueprintId = blueprint.id;
    }

    await client.blueprints.delete(blueprintId);

    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      console.log(blueprintId);
    } else {
      output(
        { id: blueprintId, status: "deleted" },
        { format: options.output, defaultFormat: "json" },
      );
    }
  } catch (error) {
    outputError("Failed to delete blueprint", error);
  }
}

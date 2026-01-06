/**
 * Get blueprint details command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface GetBlueprintOptions {
  id: string;
  output?: string;
}

export async function getBlueprint(options: GetBlueprintOptions) {
  try {
    const client = getClient();

    let blueprint;

    // Check if it's an ID (starts with bpt_) or a name
    if (options.id.startsWith("bpt_")) {
      // It's an ID, retrieve directly
      blueprint = await client.blueprints.retrieve(options.id);
    } else {
      // It's a name, search for it
      const result = await client.blueprints.list({ name: options.id });
      const blueprints = result.blueprints || [];

      if (blueprints.length === 0) {
        outputError(`Blueprint not found: ${options.id}`);
        return;
      }

      // Return the first exact match, or first result if no exact match
      blueprint =
        blueprints.find((b) => b.name === options.id) || blueprints[0];
    }

    output(blueprint, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get blueprint", error);
  }
}

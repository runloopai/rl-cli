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
    const blueprint = await client.blueprints.retrieve(options.id);
    output(blueprint, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get blueprint", error);
  }
}


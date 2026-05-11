/**
 * Display scenario definition details.
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface InfoOptions {
  output?: string;
}

export async function scenarioInfo(id: string, options: InfoOptions = {}) {
  try {
    const client = getClient();
    const scenario = await client.scenarios.retrieve(id);
    output(scenario, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get scenario info", error);
  }
}

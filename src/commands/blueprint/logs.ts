/**
 * Get blueprint build logs command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface BlueprintLogsOptions {
  id: string;
  output?: string;
}

export async function getBlueprintLogs(options: BlueprintLogsOptions) {
  try {
    const client = getClient();
    const logs = await client.blueprints.logs(options.id);
    output(logs, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get blueprint logs", error);
  }
}


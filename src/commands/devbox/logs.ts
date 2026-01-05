/**
 * Get devbox logs command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface LogsOptions {
  output?: string;
}

export async function getLogs(devboxId: string, options: LogsOptions = {}) {
  try {
    const client = getClient();
    const logs = await client.devboxes.logs.list(devboxId);
    output(logs, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get devbox logs", error);
  }
}


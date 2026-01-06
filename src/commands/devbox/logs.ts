/**
 * Get devbox logs command
 */

import type { DevboxLogsListView } from "@runloop/api-client/resources/devboxes/logs";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { formatLogsForCLI } from "../../utils/logFormatter.js";

interface LogsOptions {
  output?: string;
}

export async function getLogs(devboxId: string, options: LogsOptions = {}) {
  try {
    const client = getClient();
    const logs: DevboxLogsListView = await client.devboxes.logs.list(devboxId);

    // Pretty print for text output, JSON for others
    if (!options.output || options.output === "text") {
      formatLogsForCLI(logs);
    } else {
      output(logs, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to get devbox logs", error);
  }
}

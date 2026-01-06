/**
 * Get async execution status
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface GetAsyncOptions {
  executionId: string;
  output?: string;
}

export async function getAsync(devboxId: string, options: GetAsyncOptions) {
  try {
    const client = getClient();
    const execution = await client.devboxes.executions.retrieve(
      devboxId,
      options.executionId,
    );
    output(execution, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get async execution status", error);
  }
}

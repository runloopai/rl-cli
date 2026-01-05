/**
 * Execute command asynchronously in devbox
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface ExecAsyncOptions {
  command: string;
  shellName?: string;
  output?: string;
}

export async function execAsync(devboxId: string, options: ExecAsyncOptions) {
  try {
    const client = getClient();
    const execution = await client.devboxes.executeAsync(devboxId, {
      command: options.command,
      shell_name: options.shellName || undefined,
    });
    // Default: just output the execution ID for easy scripting
    if (!options.output || options.output === "text") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const execId = (execution as any).execution_id || (execution as any).id;
      console.log(execId);
    } else {
      output(execution, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to start async execution", error);
  }
}


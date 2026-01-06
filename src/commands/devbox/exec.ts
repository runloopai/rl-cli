/**
 * Execute command in devbox
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface ExecCommandOptions {
  shellName?: string;
  output?: string;
}

export async function execCommand(
  id: string,
  command: string[],
  options: ExecCommandOptions = {},
) {
  try {
    const client = getClient();
    const result = await client.devboxes.executeSync(id, {
      command: command.join(" "),
      shell_name: options.shellName || undefined,
    });
    
    // For text output, just print stdout/stderr directly
    if (!options.output || options.output === "text") {
      if (result.stdout) {
        console.log(result.stdout);
      }
      if (result.stderr) {
        console.error(result.stderr);
      }
      return;
    }
    
    output(result, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to execute command", error);
  }
}


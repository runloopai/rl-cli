/**
 * Shutdown devbox command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface ShutdownOptions {
  output?: string;
}

export async function shutdownDevbox(
  devboxId: string,
  options: ShutdownOptions = {},
) {
  try {
    const client = getClient();
    const devbox = await client.devboxes.shutdown(devboxId);
    output(devbox, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to shutdown devbox", error);
  }
}

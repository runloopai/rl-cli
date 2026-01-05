/**
 * Suspend devbox command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface SuspendOptions {
  output?: string;
}

export async function suspendDevbox(devboxId: string, options: SuspendOptions = {}) {
  try {
    const client = getClient();
    const devbox = await client.devboxes.suspend(devboxId);
    output(devbox, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to suspend devbox", error);
  }
}


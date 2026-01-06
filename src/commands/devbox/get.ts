/**
 * Get devbox details command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface GetOptions {
  output?: string;
}

export async function getDevbox(devboxId: string, options: GetOptions = {}) {
  try {
    const client = getClient();
    const devbox = await client.devboxes.retrieve(devboxId);
    output(devbox, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get devbox", error);
  }
}

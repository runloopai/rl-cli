/**
 * Resume devbox command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface ResumeOptions {
  output?: string;
}

export async function resumeDevbox(
  devboxId: string,
  options: ResumeOptions = {},
) {
  try {
    const client = getClient();
    const devbox = await client.devboxes.resume(devboxId);
    output(devbox, { format: options.output, defaultFormat: "text" });
  } catch (error) {
    outputError("Failed to resume devbox", error);
  }
}

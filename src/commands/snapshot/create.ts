/**
 * Create snapshot command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface CreateOptions {
  name?: string;
  output?: string;
}

export async function createSnapshot(
  devboxId: string,
  options: CreateOptions = {},
) {
  try {
    const client = getClient();
    const snapshot = await client.devboxes.snapshotDisk(devboxId, {
      ...(options.name && { name: options.name }),
    });
    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snapshotId = (snapshot as any).id || (snapshot as any).snapshot_id;
      console.log(snapshotId);
    } else {
      output(snapshot, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to create snapshot", error);
  }
}

/**
 * Get snapshot status command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface SnapshotStatusOptions {
  snapshotId: string;
  output?: string;
}

export async function getSnapshotStatus(options: SnapshotStatusOptions) {
  try {
    const client = getClient();
    const status = await client.devboxes.diskSnapshots.queryStatus(options.snapshotId);
    output(status, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get snapshot status", error);
  }
}


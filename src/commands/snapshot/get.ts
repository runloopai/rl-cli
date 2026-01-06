/**
 * Get snapshot details command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface GetSnapshotOptions {
  id: string;
  output?: string;
}

export async function getSnapshot(options: GetSnapshotOptions) {
  try {
    const client = getClient();

    // This is the way to get snapshot details
    const snapshotDetails = await client.devboxes.diskSnapshots.queryStatus(
      options.id,
    );
    output(snapshotDetails, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get snapshot", error);
  }
}

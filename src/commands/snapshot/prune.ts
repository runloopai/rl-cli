/**
 * Snapshot prune command - Delete old snapshots for a given source devbox
 */

import * as readline from "readline";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface SnapshotItem {
  id: string;
  name?: string;
  status?: string;
  create_time_ms?: number;
  source_devbox_id?: string;
}

interface PruneSnapshotsOptions {
  dryRun?: boolean;
  yes?: boolean;
  keep?: string;
  output?: string;
}

interface PruneResult {
  sourceDevboxId: string;
  totalFound: number;
  successfulSnapshots: number;
  failedSnapshots: number;
  kept: SnapshotItem[];
  deleted: SnapshotItem[];
  failed: Array<{ id: string; error: string }>;
  dryRun: boolean;
}

/**
 * Fetch all snapshots for a given source devbox (handles pagination)
 */
async function fetchAllSnapshotsForDevbox(
  devboxId: string,
): Promise<SnapshotItem[]> {
  const client = getClient();
  const allSnapshots: SnapshotItem[] = [];
  let hasMore = true;
  let startingAfter: string | undefined = undefined;

  while (hasMore) {
    const params: Record<string, unknown> = {
      devbox_id: devboxId,
      limit: 100,
    };
    if (startingAfter) {
      params.starting_after = startingAfter;
    }

    try {
      const page = await client.devboxes.listDiskSnapshots(params);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snapshots = ((page as any).snapshots || []) as SnapshotItem[];
      allSnapshots.push(...snapshots);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hasMore = (page as any).has_more || false;
      if (hasMore && snapshots.length > 0) {
        startingAfter = snapshots[snapshots.length - 1].id;
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error("Warning: Error fetching snapshots:", error);
      // Continue with partial results
      hasMore = false;
    }
  }

  return allSnapshots;
}

/**
 * Categorize snapshots into successful and failed, and determine what to keep/delete
 */
function categorizeSnapshots(snapshots: SnapshotItem[], keepCount: number) {
  // Filter successful snapshots (status "ready" means completed successfully)
  const successful = snapshots.filter((s) => s.status === "ready");

  // Filter failed/incomplete snapshots
  const failed = snapshots.filter((s) => s.status !== "ready");

  // Sort successful by create_time_ms descending (newest first)
  successful.sort((a, b) => (b.create_time_ms || 0) - (a.create_time_ms || 0));

  // Determine what to keep and delete
  const toKeep = successful.slice(0, keepCount);
  const toDelete = [...successful.slice(keepCount), ...failed];

  return {
    toKeep,
    toDelete,
    successful,
    failed,
  };
}

/**
 * Format a timestamp for display
 */
function formatTimestamp(createTimeMs?: number): string {
  if (!createTimeMs) {
    return "unknown time";
  }

  const now = Date.now();
  const diffMs = now - createTimeMs;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  }
}

/**
 * Display a summary of what will be kept and deleted
 */
function displaySummary(
  devboxId: string,
  result: {
    toKeep: SnapshotItem[];
    toDelete: SnapshotItem[];
    successful: SnapshotItem[];
    failed: SnapshotItem[];
  },
  isDryRun: boolean,
) {
  const total = result.successful.length + result.failed.length;

  console.log(`\nAnalyzing snapshots for devbox "${devboxId}"...`);
  console.log(`\nFound ${total} snapshot${total !== 1 ? "s" : ""}:`);
  console.log(
    `  ✓ ${result.successful.length} ready snapshot${result.successful.length !== 1 ? "s" : ""}`,
  );
  console.log(
    `  ✗ ${result.failed.length} failed/incomplete snapshot${result.failed.length !== 1 ? "s" : ""}`,
  );

  // Show what will be kept
  console.log(`\nKeeping (${result.toKeep.length} most recent ready):`);
  if (result.toKeep.length === 0) {
    console.log("  (none - no ready snapshots found)");
  } else {
    for (const snapshot of result.toKeep) {
      const label = snapshot.name ? ` "${snapshot.name}"` : "";
      console.log(
        `  ✓ ${snapshot.id}${label} - Created ${formatTimestamp(snapshot.create_time_ms)}`,
      );
    }
  }

  // Show what will be deleted
  console.log(
    `\n${isDryRun ? "Would delete" : "To be deleted"} (${result.toDelete.length} snapshot${result.toDelete.length !== 1 ? "s" : ""}):`,
  );
  if (result.toDelete.length === 0) {
    console.log("  (none)");
  } else {
    for (const snapshot of result.toDelete) {
      const icon = snapshot.status === "ready" ? "✓" : "⚠";
      const statusLabel =
        snapshot.status === "ready" ? "ready" : snapshot.status || "unknown";
      const label = snapshot.name ? ` "${snapshot.name}"` : "";
      console.log(
        `  ${icon} ${snapshot.id}${label} - Created ${formatTimestamp(snapshot.create_time_ms)} (${statusLabel})`,
      );
    }
  }
}

/**
 * Display all deleted snapshots
 */
function displayDeletedSnapshots(deleted: SnapshotItem[]) {
  if (deleted.length === 0) {
    return;
  }

  console.log("\nDeleted snapshots:");
  for (const snapshot of deleted) {
    const icon = snapshot.status === "ready" ? "✓" : "⚠";
    const statusLabel =
      snapshot.status === "ready" ? "ready" : snapshot.status || "unknown";
    const label = snapshot.name ? ` "${snapshot.name}"` : "";
    console.log(
      `  ${icon} ${snapshot.id}${label} - Created ${formatTimestamp(snapshot.create_time_ms)} (${statusLabel})`,
    );
  }
}

/**
 * Prompt user for confirmation
 */
async function confirmDeletion(count: number): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      `\nDelete ${count} snapshot${count !== 1 ? "s" : ""}? (y/N): `,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
      },
    );
  });
}

/**
 * Delete snapshots with error tracking
 */
async function deleteSnapshotsWithTracking(snapshots: SnapshotItem[]) {
  const client = getClient();
  const results = {
    deleted: [] as SnapshotItem[],
    failed: [] as Array<{ id: string; error: string }>,
  };

  for (const snapshot of snapshots) {
    try {
      await client.devboxes.diskSnapshots.delete(snapshot.id);
      results.deleted.push(snapshot);
    } catch (error) {
      results.failed.push({
        id: snapshot.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Main prune function
 */
export async function pruneSnapshots(
  devboxId: string,
  options: PruneSnapshotsOptions = {},
) {
  try {
    // Parse and validate options
    const isDryRun = options.dryRun || false;
    const autoConfirm = options.yes || false;
    const keepCount = parseInt(options.keep || "1", 10);

    if (isNaN(keepCount) || keepCount < 1) {
      outputError("--keep must be a positive integer");
    }

    // Fetch all snapshots for the given devbox
    console.log(`Fetching snapshots for devbox "${devboxId}"...`);
    const snapshots = await fetchAllSnapshotsForDevbox(devboxId);

    // Handle no snapshots found
    if (snapshots.length === 0) {
      console.log(`No snapshots found for devbox: ${devboxId}`);
      return;
    }

    // Categorize snapshots
    const categorized = categorizeSnapshots(snapshots, keepCount);

    // Display summary
    displaySummary(devboxId, categorized, isDryRun);

    // Handle dry-run mode
    if (isDryRun) {
      console.log("\n(Dry run - no changes made)");
      const result: PruneResult = {
        sourceDevboxId: devboxId,
        totalFound: snapshots.length,
        successfulSnapshots: categorized.successful.length,
        failedSnapshots: categorized.failed.length,
        kept: categorized.toKeep,
        deleted: [],
        failed: [],
        dryRun: true,
      };

      if (options.output && options.output !== "text") {
        output(result, { format: options.output, defaultFormat: "json" });
      }
      return;
    }

    // Handle nothing to delete
    if (categorized.toDelete.length === 0) {
      console.log("\nNothing to delete.");
      return;
    }

    // Warn if no successful snapshots
    if (categorized.successful.length === 0) {
      console.log(
        "\nWarning: No ready snapshots found. Only deleting failed/incomplete snapshots.",
      );
    }

    // Get confirmation unless --yes flag is set
    if (!autoConfirm) {
      const confirmed = await confirmDeletion(categorized.toDelete.length);
      if (!confirmed) {
        console.log("\nOperation cancelled.");
        return;
      }
    }

    // Perform deletions
    console.log(
      `\nDeleting ${categorized.toDelete.length} snapshot${categorized.toDelete.length !== 1 ? "s" : ""}...`,
    );
    const deletionResults = await deleteSnapshotsWithTracking(
      categorized.toDelete,
    );

    // Display results
    console.log("\nResults:");
    console.log(
      `  ✓ Successfully deleted: ${deletionResults.deleted.length} snapshot${deletionResults.deleted.length !== 1 ? "s" : ""}`,
    );

    // Show all deleted snapshots
    displayDeletedSnapshots(deletionResults.deleted);

    if (deletionResults.failed.length > 0) {
      console.log(
        `\n  ✗ Failed to delete: ${deletionResults.failed.length} snapshot${deletionResults.failed.length !== 1 ? "s" : ""}`,
      );
      for (const failure of deletionResults.failed) {
        console.log(`    - ${failure.id}: ${failure.error}`);
      }
    }

    // Output structured data if requested
    if (options.output && options.output !== "text") {
      const result: PruneResult = {
        sourceDevboxId: devboxId,
        totalFound: snapshots.length,
        successfulSnapshots: categorized.successful.length,
        failedSnapshots: categorized.failed.length,
        kept: categorized.toKeep,
        deleted: deletionResults.deleted,
        failed: deletionResults.failed,
        dryRun: false,
      };
      output(result, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to prune snapshots", error);
  }
}

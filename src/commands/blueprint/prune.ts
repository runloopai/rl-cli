/**
 * Blueprint prune command - Delete old blueprint builds
 */

import * as readline from "readline";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { formatRelativeTime } from "../../utils/time.js";
import type { Blueprint } from "../../store/blueprintStore.js";

interface PruneBlueprintsOptions {
  dryRun?: boolean;
  yes?: boolean;
  keep?: string;
  output?: string;
}

interface PruneResult {
  blueprintName: string;
  totalFound: number;
  successfulBuilds: number;
  failedBuilds: number;
  kept: Blueprint[];
  deleted: Blueprint[];
  failed: Array<{ id: string; error: string }>;
  dryRun: boolean;
}

/**
 * Fetch all blueprints with a given name (handles pagination)
 */
async function fetchAllBlueprintsWithName(name: string): Promise<Blueprint[]> {
  const client = getClient();
  const allBlueprints: Blueprint[] = [];
  let hasMore = true;
  let startingAfter: string | undefined = undefined;

  while (hasMore) {
    const params: Record<string, unknown> = { name, limit: 100 };
    if (startingAfter) {
      params.starting_after = startingAfter;
    }

    try {
      const page = await client.blueprints.list(params);
      const blueprints = (page.blueprints || []) as Blueprint[];
      allBlueprints.push(...blueprints);

      hasMore = page.has_more || false;
      if (hasMore && blueprints.length > 0) {
        startingAfter = blueprints[blueprints.length - 1].id;
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error("Warning: Error fetching blueprints:", error);
      // Continue with partial results
      hasMore = false;
    }
  }

  return allBlueprints;
}

/**
 * Categorize blueprints into successful and failed, and determine what to keep/delete
 */
function categorizeBlueprints(blueprints: Blueprint[], keepCount: number) {
  // Filter successful builds
  const successful = blueprints.filter((b) => b.status === "build_complete");

  // Filter failed/incomplete builds
  const failed = blueprints.filter((b) => b.status !== "build_complete");

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
 * Display a summary of what will be kept and deleted
 */
function displaySummary(
  name: string,
  result: {
    toKeep: Blueprint[];
    toDelete: Blueprint[];
    successful: Blueprint[];
    failed: Blueprint[];
  },
  isDryRun: boolean,
) {
  const total = result.successful.length + result.failed.length;

  console.log(`\nAnalyzing blueprints named "${name}"...`);
  console.log(`\nFound ${total} blueprint${total !== 1 ? "s" : ""}:`);
  console.log(
    `  ✓ ${result.successful.length} successful build${result.successful.length !== 1 ? "s" : ""}`,
  );
  console.log(
    `  ✗ ${result.failed.length} failed build${result.failed.length !== 1 ? "s" : ""}`,
  );

  // Show what will be kept
  console.log(`\nKeeping (${result.toKeep.length} most recent successful):`);
  if (result.toKeep.length === 0) {
    console.log("  (none - no successful builds found)");
  } else {
    for (const blueprint of result.toKeep) {
      console.log(
        `  ✓ ${blueprint.id} - Created ${formatRelativeTime(blueprint.create_time_ms)}`,
      );
    }
  }

  // Show what will be deleted
  console.log(
    `\n${isDryRun ? "Would delete" : "To be deleted"} (${result.toDelete.length} blueprint${result.toDelete.length !== 1 ? "s" : ""}):`,
  );
  if (result.toDelete.length === 0) {
    console.log("  (none)");
  } else {
    // Show all blueprints without summarizing
    for (const blueprint of result.toDelete) {
      const icon = blueprint.status === "build_complete" ? "✓" : "⚠";
      const statusLabel =
        blueprint.status === "build_complete" ? "successful" : "failed";
      console.log(
        `  ${icon} ${blueprint.id} - Created ${formatRelativeTime(blueprint.create_time_ms)} (${statusLabel})`,
      );
    }
  }
}

/**
 * Display all deleted blueprints
 */
function displayDeletedBlueprints(deleted: Blueprint[]) {
  if (deleted.length === 0) {
    return;
  }

  console.log("\nDeleted blueprints:");
  for (const blueprint of deleted) {
    const icon = blueprint.status === "build_complete" ? "✓" : "⚠";
    const statusLabel =
      blueprint.status === "build_complete" ? "successful" : "failed";
    console.log(
      `  ${icon} ${blueprint.id} - Created ${formatRelativeTime(blueprint.create_time_ms)} (${statusLabel})`,
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
      `\nDelete ${count} blueprint${count !== 1 ? "s" : ""}? (y/N): `,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
      },
    );
  });
}

/**
 * Delete blueprints with error tracking
 */
async function deleteBlueprintsWithTracking(blueprints: Blueprint[]) {
  const client = getClient();
  const results = {
    deleted: [] as Blueprint[],
    failed: [] as Array<{ id: string; error: string }>,
  };

  for (const blueprint of blueprints) {
    try {
      await client.blueprints.delete(blueprint.id);
      results.deleted.push(blueprint);
    } catch (error) {
      results.failed.push({
        id: blueprint.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Main prune function
 */
export async function pruneBlueprints(
  name: string,
  options: PruneBlueprintsOptions = {},
) {
  try {
    // Parse and validate options
    const isDryRun = options.dryRun || false;
    const autoConfirm = options.yes || false;
    const keepCount = parseInt(options.keep || "1", 10);

    if (isNaN(keepCount) || keepCount < 1) {
      outputError("--keep must be a positive integer");
    }

    // Fetch all blueprints with the given name
    console.log(`Fetching blueprints named "${name}"...`);
    const blueprints = await fetchAllBlueprintsWithName(name);

    // Handle no blueprints found
    if (blueprints.length === 0) {
      console.log(`No blueprints found with name: ${name}`);
      return;
    }

    // Categorize blueprints
    const categorized = categorizeBlueprints(blueprints, keepCount);

    // Display summary
    displaySummary(name, categorized, isDryRun);

    // Handle dry-run mode
    if (isDryRun) {
      console.log("\n(Dry run - no changes made)");
      const result: PruneResult = {
        blueprintName: name,
        totalFound: blueprints.length,
        successfulBuilds: categorized.successful.length,
        failedBuilds: categorized.failed.length,
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

    // Warn if no successful builds
    if (categorized.successful.length === 0) {
      console.log(
        "\nWarning: No successful builds found. Only deleting failed builds.",
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
      `\nDeleting ${categorized.toDelete.length} blueprint${categorized.toDelete.length !== 1 ? "s" : ""}...`,
    );
    const deletionResults = await deleteBlueprintsWithTracking(
      categorized.toDelete,
    );

    // Display results
    console.log("\nResults:");
    console.log(
      `  ✓ Successfully deleted: ${deletionResults.deleted.length} blueprint${deletionResults.deleted.length !== 1 ? "s" : ""}`,
    );

    // Show all deleted blueprints
    displayDeletedBlueprints(deletionResults.deleted);

    if (deletionResults.failed.length > 0) {
      console.log(
        `\n  ✗ Failed to delete: ${deletionResults.failed.length} blueprint${deletionResults.failed.length !== 1 ? "s" : ""}`,
      );
      for (const failure of deletionResults.failed) {
        console.log(`    - ${failure.id}: ${failure.error}`);
      }
    }

    // Output structured data if requested
    if (options.output && options.output !== "text") {
      const result: PruneResult = {
        blueprintName: name,
        totalFound: blueprints.length,
        successfulBuilds: categorized.successful.length,
        failedBuilds: categorized.failed.length,
        kept: categorized.toKeep,
        deleted: deletionResults.deleted,
        failed: deletionResults.failed,
        dryRun: false,
      };
      output(result, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to prune blueprints", error);
  }
}

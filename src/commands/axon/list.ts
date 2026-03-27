/**
 * List active axons (beta)
 */

import chalk from "chalk";
import {
  listActiveAxons,
  type Axon,
} from "../../services/axonService.js";
import { output, outputError, parseLimit } from "../../utils/output.js";

interface ListOptions {
  limit?: string;
  startingAfter?: string;
  output?: string;
}

const PAGE_SIZE = 100;

function formatTimeAgo(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  const date = new Date(timestampMs);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function printTable(axons: Axon[]): void {
  if (axons.length === 0) {
    console.log(chalk.dim("No active axons found"));
    return;
  }

  const COL_ID = 34;
  const COL_NAME = 28;
  const COL_CREATED = 12;

  const header =
    "ID".padEnd(COL_ID) +
    " " +
    "NAME".padEnd(COL_NAME) +
    " " +
    "CREATED".padEnd(COL_CREATED);
  console.log(chalk.bold(header));
  console.log(chalk.dim("─".repeat(header.length)));

  for (const axon of axons) {
    const id = axon.id.length > COL_ID ? axon.id.slice(0, COL_ID - 1) + "…" : axon.id;
    const nameRaw = axon.name ?? "";
    const name =
      nameRaw.length > COL_NAME
        ? nameRaw.slice(0, COL_NAME - 1) + "…"
        : nameRaw;
    const created = formatTimeAgo(axon.created_at_ms);
    console.log(
      `${id.padEnd(COL_ID)} ${name.padEnd(COL_NAME)} ${created.padEnd(COL_CREATED)}`,
    );
  }

  console.log();
  console.log(
    chalk.dim(`${axons.length} axon${axons.length !== 1 ? "s" : ""}`),
  );
}

async function fetchAllAxons(maxResults: number): Promise<Axon[]> {
  const all: Axon[] = [];
  let cursor: string | undefined;

  while (all.length < maxResults) {
    const remaining = maxResults - all.length;
    const pageLimit = Math.min(PAGE_SIZE, remaining);

    const { axons, hasMore } = await listActiveAxons({
      limit: pageLimit,
      startingAfter: cursor,
    });

    all.push(...axons);

    if (!hasMore || axons.length === 0) {
      break;
    }

    cursor = axons[axons.length - 1].id;
  }

  return all;
}

export async function listAxonsCommand(options: ListOptions): Promise<void> {
  try {
    const maxResults = parseLimit(options.limit);
    const format = options.output || "text";

    let axons: Axon[];

    if (options.startingAfter) {
      const pageLimit =
        maxResults === Infinity ? PAGE_SIZE : maxResults;
      const { axons: page, hasMore } = await listActiveAxons({
        limit: pageLimit,
        startingAfter: options.startingAfter,
      });
      axons = page;
      if (format === "text" && hasMore && axons.length > 0) {
        console.log(
          chalk.dim(
            "More results may be available; use --starting-after with the last ID to continue.",
          ),
        );
        console.log();
      }
    } else {
      axons = await fetchAllAxons(maxResults);
    }

    if (format !== "text") {
      output(axons, { format, defaultFormat: "json" });
    } else {
      printTable(axons);
    }
  } catch (error) {
    outputError("Failed to list active axons", error);
  }
}

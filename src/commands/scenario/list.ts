/**
 * List scenario runs command
 */

import chalk from "chalk";
import { listScenarioRuns } from "../../services/benchmarkService.js";
import type { ScenarioRun } from "../../store/benchmarkStore.js";
import { output, outputError, parseLimit } from "../../utils/output.js";
import { formatTimeAgo } from "../../utils/time.js";

interface ListOptions {
  limit?: string;
  benchmarkRunId?: string;
  output?: string;
}

const PAGE_SIZE = 100;

const COL_ID = 34;
const COL_STATUS = 12;
const COL_SCORE = 8;
const COL_CREATED = 12;
const FIXED_WIDTH = COL_ID + COL_STATUS + COL_SCORE + COL_CREATED + 4;

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

function colorState(state: string): string {
  switch (state) {
    case "completed":
    case "scored":
      return chalk.green(state);
    case "running":
    case "scoring":
      return chalk.yellow(state);
    case "failed":
    case "timeout":
      return chalk.red(state);
    case "canceled":
      return chalk.dim(state);
    default:
      return state;
  }
}

async function fetchRuns(
  benchmarkRunId?: string,
  maxResults?: number,
): Promise<ScenarioRun[]> {
  const all: ScenarioRun[] = [];
  let cursor: string | undefined;
  while (true) {
    const pageLimit =
      maxResults && maxResults > 0
        ? Math.min(PAGE_SIZE, maxResults - all.length)
        : PAGE_SIZE;
    const result = await listScenarioRuns({
      limit: pageLimit,
      startingAfter: cursor,
      benchmarkRunId,
    });
    all.push(...result.scenarioRuns);
    if (!result.hasMore || result.scenarioRuns.length === 0) break;
    if (maxResults && maxResults > 0 && all.length >= maxResults) break;
    cursor = result.scenarioRuns[result.scenarioRuns.length - 1].id;
  }
  return all;
}

function printTable(runs: ScenarioRun[]): void {
  if (runs.length === 0) {
    console.log(chalk.dim("No scenario runs found"));
    return;
  }

  const termWidth = process.stdout.columns || 120;
  const nameWidth = Math.max(10, termWidth - FIXED_WIDTH);

  const header =
    "ID".padEnd(COL_ID) +
    " " +
    "NAME".padEnd(nameWidth) +
    " " +
    "STATUS".padEnd(COL_STATUS) +
    " " +
    "SCORE".padStart(COL_SCORE) +
    " " +
    "CREATED".padEnd(COL_CREATED);
  console.log(chalk.bold(header));
  console.log(chalk.dim("─".repeat(Math.min(header.length, termWidth))));

  for (const run of runs) {
    const id = truncate(run.id, COL_ID).padEnd(COL_ID);
    const name = truncate(run.name || "", nameWidth).padEnd(nameWidth);
    const status = colorState(run.state || "unknown");
    const statusRaw = run.state || "unknown";
    const statusPad = " ".repeat(Math.max(0, COL_STATUS - statusRaw.length));

    let scoreStr: string;
    const score = run.scoring_contract_result?.score;
    if (score !== undefined && score !== null) {
      const pct = Math.round(score * 100);
      const pctStr = `${pct}%`.padStart(COL_SCORE);
      scoreStr = pct >= 50 ? chalk.green(pctStr) : chalk.yellow(pctStr);
    } else {
      scoreStr = chalk.dim("N/A".padStart(COL_SCORE));
    }

    const created = run.start_time_ms
      ? formatTimeAgo(run.start_time_ms).padEnd(COL_CREATED)
      : chalk.dim("N/A".padEnd(COL_CREATED));

    console.log(`${id} ${name} ${status}${statusPad} ${scoreStr} ${created}`);
  }

  console.log();
  console.log(chalk.dim(`${runs.length} run${runs.length !== 1 ? "s" : ""}`));
}

export async function listScenarioRunsCommand(
  options: ListOptions,
): Promise<void> {
  try {
    const maxResults = parseLimit(options.limit);
    const runs = await fetchRuns(
      options.benchmarkRunId,
      maxResults === Infinity ? undefined : maxResults,
    );

    runs.sort((a, b) => (a.start_time_ms || 0) - (b.start_time_ms || 0));

    const format = options.output || "text";
    if (format !== "text") {
      output(runs, { format, defaultFormat: "json" });
    } else {
      printTable(runs);
    }
  } catch (error) {
    outputError("Failed to list scenario runs", error);
  }
}

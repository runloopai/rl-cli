/**
 * List benchmark jobs command
 */

import chalk from "chalk";
import {
  listBenchmarkJobs,
  listBenchmarkRunScenarioRuns,
  type BenchmarkJob,
} from "../../services/benchmarkJobService.js";
import { output, outputError } from "../../utils/output.js";

interface ListOptions {
  days?: string;
  all?: boolean;
  status?: string;
  output?: string;
}

const VALID_STATES = [
  "initializing",
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
  "timeout",
];

const PAGE_SIZE = 100;

// --- Time formatting ---

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

// --- Job stats aggregation ---

interface JobStats {
  done: number;
  total: number;
  errors: number;
  avgScore: number | null;
}

// Scenario run states that count as finished
const SCENARIO_DONE_STATES = new Set([
  "completed",
  "failed",
  "canceled",
  "timeout",
  "error",
]);

async function aggregateJobStats(job: BenchmarkJob): Promise<JobStats> {
  const outcomes = job.benchmark_outcomes || [];
  const scenarioCount = job.job_spec?.scenario_ids?.length || 0;
  const agentCount = job.job_spec?.agent_configs?.length || 1;
  const total = scenarioCount * agentCount;

  let done = 0;
  let errors = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  // Count from completed benchmark runs
  for (const outcome of outcomes) {
    done += outcome.n_completed + outcome.n_failed + outcome.n_timeout;
    errors += outcome.n_failed + outcome.n_timeout;
    if (outcome.average_score !== undefined && outcome.average_score !== null) {
      scoreSum += outcome.average_score;
      scoreCount++;
    }
  }

  // Count finished scenarios from in-progress benchmark runs
  const inProgressRuns = job.in_progress_runs || [];
  if (inProgressRuns.length > 0) {
    const runResults = await Promise.all(
      inProgressRuns.map((run) =>
        listBenchmarkRunScenarioRuns(run.benchmark_run_id),
      ),
    );
    for (const scenarioRuns of runResults) {
      let runScoreSum = 0;
      let runScoreCount = 0;
      for (const sr of scenarioRuns) {
        const state = sr.state?.toLowerCase() || "";
        if (SCENARIO_DONE_STATES.has(state)) {
          done++;
          if (state !== "completed") {
            errors++;
          }
          const score = sr.scoring_contract_result?.score;
          if (score !== undefined && score !== null) {
            runScoreSum += score;
            runScoreCount++;
          }
        }
      }
      if (runScoreCount > 0) {
        scoreSum += runScoreSum / runScoreCount;
        scoreCount++;
      }
    }
  }

  return {
    done,
    total: total || done,
    errors,
    avgScore: scoreCount > 0 ? scoreSum / scoreCount : null,
  };
}

// --- Status coloring ---

function colorState(state: string): string {
  switch (state) {
    case "running":
      return chalk.yellow(state);
    case "completed":
      return chalk.green(state);
    case "failed":
    case "timeout":
      return chalk.red(state);
    case "cancelled":
      return chalk.dim(state);
    case "initializing":
    case "queued":
      return chalk.cyan(state);
    default:
      return state;
  }
}

// --- Table printing ---

// Fixed column widths (excluding NAME which is dynamic)
const COL_ID = 30;
const COL_STARTED = 10;
const COL_STATUS = 14;
const COL_DONE = 9;
const COL_ERRORS = 8;
const COL_SCORE = 7;
const FIXED_WIDTH =
  COL_ID + COL_STARTED + COL_STATUS + COL_DONE + COL_ERRORS + COL_SCORE + 6; // 6 for spacing

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

async function printTable(jobs: BenchmarkJob[]): Promise<void> {
  if (jobs.length === 0) {
    console.log(chalk.dim("No benchmark jobs found"));
    return;
  }

  const termWidth = process.stdout.columns || 120;
  const nameWidth = Math.max(10, termWidth - FIXED_WIDTH);

  // Header
  const header =
    "ID".padEnd(COL_ID) +
    " " +
    "NAME".padEnd(nameWidth) +
    " " +
    "STARTED".padEnd(COL_STARTED) +
    " " +
    "STATUS".padEnd(COL_STATUS) +
    " " +
    "DONE".padStart(COL_DONE) +
    " " +
    "ERRORS".padStart(COL_ERRORS) +
    " " +
    "SCORE".padStart(COL_SCORE);
  console.log(chalk.bold(header));
  console.log(chalk.dim("─".repeat(Math.min(header.length, termWidth))));

  // Rows
  for (const job of jobs) {
    const stats = await aggregateJobStats(job);

    const id = truncate(job.id, COL_ID).padEnd(COL_ID);
    const name = truncate(job.name || "", nameWidth).padEnd(nameWidth);
    const started = formatTimeAgo(job.create_time_ms).padEnd(COL_STARTED);
    const status = colorState(job.state || "unknown");
    // Pad status accounting for chalk invisible chars
    const statusRaw = job.state || "unknown";
    const statusPad = " ".repeat(Math.max(0, COL_STATUS - statusRaw.length));

    const doneStr = `${stats.done}/${stats.total}`.padStart(COL_DONE);
    const errorsStr = String(stats.errors).padStart(COL_ERRORS);
    const coloredErrors =
      stats.errors > 0 ? chalk.red(errorsStr) : chalk.dim(errorsStr);

    let scoreStr: string;
    if (stats.avgScore !== null) {
      const pct = Math.round(stats.avgScore * 100);
      const pctStr = `${pct}%`.padStart(COL_SCORE);
      scoreStr = pct >= 50 ? chalk.green(pctStr) : chalk.yellow(pctStr);
    } else {
      scoreStr = chalk.dim("N/A".padStart(COL_SCORE));
    }

    console.log(
      `${id} ${name} ${started} ${status}${statusPad} ${doneStr} ${coloredErrors} ${scoreStr}`,
    );
  }

  console.log();
  console.log(chalk.dim(`${jobs.length} job${jobs.length !== 1 ? "s" : ""}`));
}

// --- Pagination and filtering ---

async function fetchJobs(
  cutoffMs: number | null,
  statusFilter: Set<string> | null,
): Promise<BenchmarkJob[]> {
  const allJobs: BenchmarkJob[] = [];
  let cursor: string | undefined;

  while (true) {
    const result = await listBenchmarkJobs({
      limit: PAGE_SIZE,
      startingAfter: cursor,
    });

    for (const job of result.jobs) {
      // Stop pagination if we've passed the time cutoff (API returns newest-first)
      if (cutoffMs !== null && job.create_time_ms < cutoffMs) {
        return applyStatusFilter(allJobs, statusFilter);
      }
      allJobs.push(job);
    }

    if (!result.hasMore || result.jobs.length === 0) break;
    cursor = result.jobs[result.jobs.length - 1].id;
  }

  return applyStatusFilter(allJobs, statusFilter);
}

function applyStatusFilter(
  jobs: BenchmarkJob[],
  statusFilter: Set<string> | null,
): BenchmarkJob[] {
  if (!statusFilter) return jobs;
  return jobs.filter((job) => statusFilter.has(job.state?.toLowerCase() || ""));
}

// --- Command entry point ---

export async function listBenchmarkJobsCommand(
  options: ListOptions,
): Promise<void> {
  try {
    // Parse status filter
    let statusFilter: Set<string> | null = null;
    if (options.status) {
      const statuses = options.status
        .split(",")
        .map((s) => s.trim().toLowerCase());
      const invalid = statuses.filter((s) => !VALID_STATES.includes(s));
      if (invalid.length > 0) {
        outputError(
          `Invalid status: ${invalid.join(", ")}. Valid: ${VALID_STATES.join(", ")}`,
        );
      }
      statusFilter = new Set(statuses);
    }

    // Compute time cutoff
    let cutoffMs: number | null = null;
    if (!options.all) {
      const days = options.days ? parseInt(options.days, 10) : 1;
      if (isNaN(days) || days <= 0) {
        outputError("--days must be a positive integer");
      }
      cutoffMs = Date.now() - days * 86_400_000;
    }

    // Fetch and filter
    const jobs = await fetchJobs(cutoffMs, statusFilter);

    // Sort ascending by create_time_ms (oldest first, most recent at bottom)
    jobs.sort((a, b) => a.create_time_ms - b.create_time_ms);

    // Output
    const format = options.output || "text";
    if (format !== "text") {
      output(jobs, { format, defaultFormat: "json" });
    } else {
      await printTable(jobs);
    }
  } catch (error) {
    outputError("Failed to list benchmark jobs", error);
  }
}

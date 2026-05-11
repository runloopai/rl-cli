/**
 * List benchmark jobs command
 */

import {
  listBenchmarkJobs,
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

    output(jobs, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list benchmark jobs", error);
  }
}

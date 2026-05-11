/**
 * List scenario runs command
 */

import { listScenarioRuns } from "../../services/benchmarkService.js";
import type { ScenarioRun } from "../../store/benchmarkStore.js";
import { output, outputError, parseLimit } from "../../utils/output.js";

interface ListOptions {
  limit?: string;
  benchmarkRunId?: string;
  output?: string;
}

const PAGE_SIZE = 100;

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

    output(runs, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list scenario runs", error);
  }
}

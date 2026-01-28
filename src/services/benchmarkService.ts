/**
 * Benchmark Service - Handles all benchmark-related API calls
 */
import { getClient } from "../utils/client.js";
import type { BenchmarkRun, ScenarioRun } from "../store/benchmarkStore.js";
import type { BenchmarkRunListParams } from "@runloop/api-client/resources/benchmark-runs";
import type { RunListParams } from "@runloop/api-client/resources/scenarios/runs";

export interface ListBenchmarkRunsOptions {
  limit: number;
  startingAfter?: string;
}

export interface ListBenchmarkRunsResult {
  benchmarkRuns: BenchmarkRun[];
  totalCount: number;
  hasMore: boolean;
}

export interface ListScenarioRunsOptions {
  limit: number;
  startingAfter?: string;
  benchmarkRunId?: string;
}

export interface ListScenarioRunsResult {
  scenarioRuns: ScenarioRun[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * List benchmark runs with pagination
 */
export async function listBenchmarkRuns(
  options: ListBenchmarkRunsOptions,
): Promise<ListBenchmarkRunsResult> {
  const client = getClient();

  const queryParams: BenchmarkRunListParams = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }

  const page = await client.benchmarkRuns.list(queryParams);
  const benchmarkRuns = page.runs || [];

  return {
    benchmarkRuns,
    totalCount: page.total_count || benchmarkRuns.length,
    hasMore: page.has_more || false,
  };
}

/**
 * Get benchmark run by ID
 */
export async function getBenchmarkRun(id: string): Promise<BenchmarkRun> {
  const client = getClient();
  return client.benchmarkRuns.retrieve(id);
}

/**
 * List scenario runs with pagination
 */
export async function listScenarioRuns(
  options: ListScenarioRunsOptions,
): Promise<ListScenarioRunsResult> {
  const client = getClient();

  // If we have a benchmark run ID, use the dedicated endpoint
  if (options.benchmarkRunId) {
    const queryParams: { limit?: number; starting_after?: string } = {
      limit: options.limit,
    };

    if (options.startingAfter) {
      queryParams.starting_after = options.startingAfter;
    }

    const page = await client.benchmarkRuns.listScenarioRuns(
      options.benchmarkRunId,
      queryParams,
    );
    const scenarioRuns = page.runs || [];

    return {
      scenarioRuns,
      totalCount: page.total_count || scenarioRuns.length,
      hasMore: page.has_more || false,
    };
  }

  // Otherwise, list all scenario runs
  const queryParams: RunListParams = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }

  const page = await client.scenarios.runs.list(queryParams);
  const scenarioRuns = page.runs || [];

  return {
    scenarioRuns,
    totalCount: page.total_count || scenarioRuns.length,
    hasMore: page.has_more || false,
  };
}

/**
 * Get scenario run by ID
 */
export async function getScenarioRun(id: string): Promise<ScenarioRun> {
  const client = getClient();
  return client.scenarios.runs.retrieve(id);
}

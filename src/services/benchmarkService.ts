/**
 * Benchmark Service - Handles all benchmark-related API calls
 */
import { getClient } from "../utils/client.js";
import type {
  BenchmarkRun,
  ScenarioRun,
  Benchmark,
} from "../store/benchmarkStore.js";
import type { BenchmarkRunListParams } from "@runloop/api-client/resources/benchmark-runs";
import type { RunListParams } from "@runloop/api-client/resources/scenarios/runs";
import type { Scenario } from "./scenarioService.js";

export interface ListBenchmarksOptions {
  limit: number;
  startingAfter?: string;
  search?: string;
}

export interface ListBenchmarksResult {
  benchmarks: Benchmark[];
  totalCount: number;
  hasMore: boolean;
}

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
    totalCount: benchmarkRuns.length,
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
      totalCount: scenarioRuns.length,
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
    totalCount: scenarioRuns.length,
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

/**
 * List benchmark definitions with pagination
 */
export async function listBenchmarks(
  options: ListBenchmarksOptions,
): Promise<ListBenchmarksResult> {
  const client = getClient();

  const queryParams: {
    limit?: number;
    starting_after?: string;
    search?: string;
  } = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }

  if (options.search) {
    queryParams.search = options.search;
  }

  const page = await client.benchmarks.list(queryParams);
  const benchmarks = page.benchmarks || [];

  return {
    benchmarks,
    totalCount: benchmarks.length,
    hasMore: page.has_more || false,
  };
}

/**
 * Get benchmark definition by ID
 */
export async function getBenchmark(id: string): Promise<Benchmark> {
  const client = getClient();
  return client.benchmarks.retrieve(id);
}

const BENCHMARK_DEFINITIONS_PAGE_SIZE = 500;

/**
 * List all scenario definitions for a benchmark (paginated).
 */
export async function listAllBenchmarkScenarioDefinitions(
  benchmarkId: string,
): Promise<Scenario[]> {
  const client = getClient();
  const all: Scenario[] = [];
  let startingAfter: string | undefined;

  for (;;) {
    const page = await client.benchmarks.definitions(benchmarkId, {
      limit: BENCHMARK_DEFINITIONS_PAGE_SIZE,
      starting_after: startingAfter,
    });
    const batch = page.scenarios ?? [];
    all.push(...batch);
    if (!page.has_more || batch.length === 0) break;
    const last = batch[batch.length - 1];
    if (!last?.id) break;
    startingAfter = last.id;
  }

  return all;
}

/**
 * List public benchmark definitions with pagination
 */
export async function listPublicBenchmarks(
  options: ListBenchmarksOptions,
): Promise<ListBenchmarksResult> {
  const client = getClient();

  const queryParams: {
    limit?: number;
    starting_after?: string;
    search?: string;
  } = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }

  if (options.search) {
    queryParams.search = options.search;
  }

  const page = await client.benchmarks.listPublic(queryParams);
  const benchmarks = page.benchmarks || [];

  return {
    benchmarks,
    totalCount: benchmarks.length,
    hasMore: page.has_more || false,
  };
}

/**
 * Create/start a benchmark run with selected benchmarks
 */
export async function createBenchmarkRun(
  benchmarkIds: string[],
  options?: { name?: string; metadata?: Record<string, string> },
): Promise<BenchmarkRun> {
  const client = getClient();

  const createParams: {
    benchmark_ids: string[];
    name?: string;
    metadata?: Record<string, string>;
  } = {
    benchmark_ids: benchmarkIds,
  };

  if (options?.name) {
    createParams.name = options.name;
  }

  if (options?.metadata) {
    createParams.metadata = options.metadata;
  }

  // Use type assertion since the API client types may not be fully defined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client.benchmarkRuns as any).create(createParams);
}

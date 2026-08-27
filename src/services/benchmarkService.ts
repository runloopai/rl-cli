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

export interface ListBenchmarksOptions {
  limit: number;
  startingAfter?: string;
  search?: string;
  includeTotalCount?: boolean;
}

export interface ListBenchmarksResult {
  benchmarks: Benchmark[];
  totalCount?: number;
  hasMore: boolean;
}

export interface ListBenchmarkRunsOptions {
  limit: number;
  startingAfter?: string;
  benchmarkId?: string;
  includeTotalCount?: boolean;
}

export interface ListBenchmarkRunsResult {
  benchmarkRuns: BenchmarkRun[];
  totalCount?: number;
  hasMore: boolean;
}

export interface ListScenarioRunsOptions {
  limit: number;
  startingAfter?: string;
  benchmarkRunId?: string;
  includeTotalCount?: boolean;
}

export interface ListScenarioRunsResult {
  scenarioRuns: ScenarioRun[];
  totalCount?: number;
  hasMore: boolean;
}

/**
 * List benchmark runs with pagination
 */
export async function listBenchmarkRuns(
  options: ListBenchmarkRunsOptions,
): Promise<ListBenchmarkRunsResult> {
  const client = getClient();

  const queryParams: BenchmarkRunListParams & {
    include_total_count?: boolean;
  } = {
    limit: options.limit,
    include_total_count: options.includeTotalCount === true,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }
  if (options.benchmarkId) {
    queryParams.benchmark_id = options.benchmarkId;
  }

  const page = await client.benchmarkRuns.list(queryParams);
  const benchmarkRuns = page.runs || [];

  return {
    benchmarkRuns,
    totalCount: (page as unknown as { total_count?: number }).total_count,
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
    const queryParams: {
      limit?: number;
      starting_after?: string;
      include_total_count?: boolean;
    } = {
      limit: options.limit,
      include_total_count: options.includeTotalCount === true,
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
      totalCount: (page as unknown as { total_count?: number }).total_count,
      hasMore: page.has_more || false,
    };
  }

  // Otherwise, list all scenario runs
  const queryParams: RunListParams & { include_total_count?: boolean } = {
    limit: options.limit,
    include_total_count: options.includeTotalCount === true,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }

  const page = await client.scenarios.runs.list(queryParams);
  const scenarioRuns = page.runs || [];

  return {
    scenarioRuns,
    totalCount: (page as unknown as { total_count?: number }).total_count,
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
    include_total_count?: boolean;
  } = {
    limit: options.limit,
    include_total_count: options.includeTotalCount === true,
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
    totalCount: (page as unknown as { total_count?: number }).total_count,
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
    include_total_count?: boolean;
  } = {
    limit: options.limit,
    include_total_count: options.includeTotalCount === true,
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
    totalCount: (page as unknown as { total_count?: number }).total_count,
    hasMore: page.has_more || false,
  };
}

/**
 * Create/start a benchmark run with selected benchmarks (POST /v1/benchmark_runs)
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

export async function cancelBenchmarkRun(id: string): Promise<BenchmarkRun> {
  const client = getClient();
  return client.benchmarkRuns.cancel(id);
}

export async function completeBenchmarkRun(id: string): Promise<BenchmarkRun> {
  const client = getClient();
  return client.benchmarkRuns.complete(id);
}

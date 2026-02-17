/**
 * Benchmark Job Service - Handles API calls for benchmark jobs
 */
import { getClient } from "../utils/client.js";
import type {
  BenchmarkJobView,
  BenchmarkJobListView,
  BenchmarkJobCreateParams,
} from "@runloop/api-client/resources/benchmark-jobs";

// Re-export types
export type BenchmarkJob = BenchmarkJobView;
export type { BenchmarkJobCreateParams };

export interface ListBenchmarkJobsOptions {
  limit?: number;
  startingAfter?: string;
  name?: string;
}

export interface ListBenchmarkJobsResult {
  jobs: BenchmarkJob[];
  totalCount: number;
  hasMore: boolean;
}

export interface AgentConfig {
  name: string;
  agentId?: string;
  modelName?: string;
  timeoutSeconds?: number;
  kwargs?: Record<string, string>;
  environmentVariables?: Record<string, string>;
  secrets?: Record<string, string>;
}

export interface OrchestratorConfig {
  nAttempts?: number;
  nConcurrentTrials?: number;
  quiet?: boolean;
  timeoutMultiplier?: number;
}

export interface CreateBenchmarkJobOptions {
  name?: string;
  benchmarkId?: string;
  scenarioIds?: string[];
  agentConfigs: AgentConfig[];
  orchestratorConfig?: OrchestratorConfig;
}

/**
 * List benchmark jobs with pagination
 */
export async function listBenchmarkJobs(
  options: ListBenchmarkJobsOptions,
): Promise<ListBenchmarkJobsResult> {
  const client = getClient();

  const queryParams: {
    limit?: number;
    starting_after?: string;
    name?: string;
  } = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }

  if (options.name) {
    queryParams.name = options.name;
  }

  const page: BenchmarkJobListView =
    await client.benchmarkJobs.list(queryParams);
  const jobs = page.jobs || [];

  return {
    jobs,
    totalCount: page.total_count || jobs.length,
    hasMore: page.has_more || false,
  };
}

/**
 * Get benchmark job by ID
 */
export async function getBenchmarkJob(id: string): Promise<BenchmarkJob> {
  const client = getClient();
  return client.benchmarkJobs.retrieve(id);
}

/**
 * Create a benchmark job with either benchmark definition spec or scenario definition spec
 */
export async function createBenchmarkJob(
  options: CreateBenchmarkJobOptions,
): Promise<BenchmarkJob> {
  const client = getClient();

  // Validate that either benchmarkId or scenarioIds is provided
  if (!options.benchmarkId && !options.scenarioIds) {
    throw new Error("Either benchmarkId or scenarioIds must be provided");
  }
  if (options.benchmarkId && options.scenarioIds) {
    throw new Error("Cannot specify both benchmarkId and scenarioIds");
  }

  // Build agent configs in API format (matches BenchmarkDefinitionJobSpec.AgentConfig)
  type ApiAgentConfig =
    BenchmarkJobCreateParams.BenchmarkDefinitionJobSpec.AgentConfig;
  const agentConfigs: ApiAgentConfig[] = options.agentConfigs.map((agent) => {
    const config: ApiAgentConfig = {
      name: agent.name,
      type: "job_agent",
    };

    if (agent.agentId) {
      config.agent_id = agent.agentId;
    }
    if (agent.modelName) {
      config.model_name = agent.modelName;
    }
    if (agent.timeoutSeconds) {
      config.timeout_seconds = agent.timeoutSeconds;
    }
    if (agent.kwargs && Object.keys(agent.kwargs).length > 0) {
      config.kwargs = agent.kwargs;
    }
    if (
      (agent.environmentVariables &&
        Object.keys(agent.environmentVariables).length > 0) ||
      (agent.secrets && Object.keys(agent.secrets).length > 0)
    ) {
      config.agent_environment = {};
      if (
        agent.environmentVariables &&
        Object.keys(agent.environmentVariables).length > 0
      ) {
        config.agent_environment.environment_variables =
          agent.environmentVariables;
      }
      if (agent.secrets && Object.keys(agent.secrets).length > 0) {
        config.agent_environment.secrets = agent.secrets;
      }
    }

    return config;
  });

  // Build orchestrator config if provided
  let orchestratorConfig: Record<string, unknown> | undefined;
  if (options.orchestratorConfig) {
    orchestratorConfig = {};
    if (options.orchestratorConfig.nAttempts !== undefined) {
      orchestratorConfig.n_attempts = options.orchestratorConfig.nAttempts;
    }
    if (options.orchestratorConfig.nConcurrentTrials !== undefined) {
      orchestratorConfig.n_concurrent_trials =
        options.orchestratorConfig.nConcurrentTrials;
    }
    if (options.orchestratorConfig.quiet !== undefined) {
      orchestratorConfig.quiet = options.orchestratorConfig.quiet;
    }
    if (options.orchestratorConfig.timeoutMultiplier !== undefined) {
      orchestratorConfig.timeout_multiplier =
        options.orchestratorConfig.timeoutMultiplier;
    }
  }

  // Build the appropriate spec based on what's provided
  let spec: BenchmarkJobCreateParams["spec"];
  if (options.benchmarkId) {
    spec = {
      type: "benchmark" as const,
      benchmark_id: options.benchmarkId,
      agent_configs: agentConfigs,
      orchestrator_config: orchestratorConfig,
    };
  } else if (options.scenarioIds) {
    spec = {
      type: "scenarios" as const,
      scenario_ids: options.scenarioIds,
      agent_configs: agentConfigs,
      orchestrator_config: orchestratorConfig,
    };
  }

  const createParams: BenchmarkJobCreateParams = {
    name: options.name,
    spec,
  };

  return client.benchmarkJobs.create(createParams);
}

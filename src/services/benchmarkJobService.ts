/**
 * Benchmark Job Service - Handles API calls for benchmark jobs
 */
import { getClient } from "../utils/client.js";
import type {
  BenchmarkJobView,
  BenchmarkJobListView,
  BenchmarkJobCreateParams,
} from "@runloop/api-client/resources/benchmark-jobs";
import type {
  BenchmarkRunView,
  BenchmarkRunListScenarioRunsParams,
} from "@runloop/api-client/resources/benchmark-runs";
import type { ScenarioRunView } from "@runloop/api-client/resources/scenarios";

// Re-export types
export type BenchmarkJob = BenchmarkJobView;
export type BenchmarkRun = BenchmarkRunView;
export type ScenarioRun = ScenarioRunView;
export type { BenchmarkJobCreateParams };

/**
 * Extract clone parameters from a benchmark job for navigating to the create screen.
 * Handles source type detection, agent config mapping (with secrets format variants),
 * and orchestrator config extraction.
 */
export function buildCloneParams(job: BenchmarkJob): Record<string, string> {
  const params: Record<string, string> = {
    cloneFromJobId: job.id,
    cloneJobName: job.name ?? "",
  };

  // Determine source type and extract IDs
  if (job.job_spec) {
    const spec = job.job_spec as any;

    if (spec.scenario_ids && Array.isArray(spec.scenario_ids)) {
      params.cloneSourceType = "scenarios";
      params.initialScenarioIds = spec.scenario_ids.join(",");
    } else if (spec.benchmark_id) {
      params.cloneSourceType = "benchmark";
      params.initialBenchmarkIds = spec.benchmark_id;
    } else if (job.job_source) {
      const source = job.job_source as any;
      if (source.scenario_ids && Array.isArray(source.scenario_ids)) {
        params.cloneSourceType = "scenarios";
        params.initialScenarioIds = source.scenario_ids.join(",");
      } else if (source.benchmark_id) {
        params.cloneSourceType = "benchmark";
        params.initialBenchmarkIds = source.benchmark_id;
      }
    }
  }

  // Extract agent configs
  if (job.job_spec?.agent_configs) {
    const agentConfigs = job.job_spec.agent_configs.map((a: any) => {
      const env = a.agent_environment;
      const secrets =
        env?.secrets ??
        env?.secret_names ??
        (typeof env?.secret_refs === "object" && env.secret_refs
          ? env.secret_refs
          : undefined);
      return {
        agentId: a.agent_id,
        name: a.name,
        modelName: a.model_name,
        timeoutSeconds: a.timeout_seconds,
        kwargs: a.kwargs,
        environmentVariables: env?.environment_variables,
        secrets,
      };
    });
    params.cloneAgentConfigs = JSON.stringify(agentConfigs);

    // Also extract legacy fields for form initialization
    params.cloneAgentIds = job.job_spec.agent_configs
      .map((a: any) => a.agent_id)
      .join(",");
    params.cloneAgentNames = job.job_spec.agent_configs
      .map((a: any) => a.name)
      .join(",");
  }

  // Extract orchestrator config
  if (job.job_spec?.orchestrator_config) {
    const orch = job.job_spec.orchestrator_config;
    params.cloneOrchestratorConfig = JSON.stringify({
      nAttempts: orch.n_attempts,
      nConcurrentTrials: orch.n_concurrent_trials,
      quiet: orch.quiet,
      timeoutMultiplier: orch.timeout_multiplier,
    });
  }

  return params;
}

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
    totalCount: jobs.length,
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
 * Get benchmark run by ID
 */
export async function getBenchmarkRun(id: string): Promise<BenchmarkRun> {
  const client = getClient();
  return client.benchmarkRuns.retrieve(id);
}

/**
 * List scenario runs for a benchmark run
 */
export async function listBenchmarkRunScenarioRuns(
  benchmarkRunId: string,
  options?: BenchmarkRunListScenarioRunsParams,
): Promise<ScenarioRun[]> {
  const client = getClient();
  const scenarioRuns: ScenarioRun[] = [];

  // Paginate through all scenario runs
  for await (const run of client.benchmarkRuns.listScenarioRuns(
    benchmarkRunId,
    { limit: 100, ...options },
  )) {
    scenarioRuns.push(run);
  }

  return scenarioRuns;
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

  // Build agent configs in API format
  // Use the same agent config type for both spec types
  const agentConfigs: Array<any> = options.agentConfigs.map((agent) => {
    const config: any = {
      name: agent.name,
      type: "job_agent" as const,
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
  let orchestratorConfig: any;
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

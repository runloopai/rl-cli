import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockCreate = jest.fn();
const mockList = jest.fn();
const mockRetrieve = jest.fn();
const mockBenchmarkRunsRetrieve = jest.fn();
const mockBenchmarkRunsListScenarioRuns = jest.fn();

jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    benchmarkJobs: {
      create: mockCreate,
      list: mockList,
      retrieve: mockRetrieve,
    },
    benchmarkRuns: {
      retrieve: mockBenchmarkRunsRetrieve,
      listScenarioRuns: mockBenchmarkRunsListScenarioRuns,
    },
  }),
}));

const {
  buildCloneParams,
  createBenchmarkJob,
  listBenchmarkJobs,
  getBenchmarkJob,
  getBenchmarkRun,
  listBenchmarkRunScenarioRuns,
} = await import("@/services/benchmarkJobService.js");

describe("buildCloneParams", () => {
  it("extracts scenario_ids from job_spec", () => {
    const job = {
      id: "bj_1",
      name: "test-job",
      job_spec: { scenario_ids: ["s1", "s2"], agent_configs: [] },
      job_source: null,
    } as any;

    const params = buildCloneParams(job);
    expect(params.cloneSourceType).toBe("scenarios");
    expect(params.initialScenarioIds).toBe("s1,s2");
  });

  it("extracts benchmark_id from job_spec", () => {
    const job = {
      id: "bj_2",
      name: "test-job",
      job_spec: { benchmark_id: "bm_1", agent_configs: [] },
      job_source: null,
    } as any;

    const params = buildCloneParams(job);
    expect(params.cloneSourceType).toBe("benchmark");
    expect(params.initialBenchmarkIds).toBe("bm_1");
  });

  it("falls back to job_source when job_spec has neither", () => {
    const job = {
      id: "bj_3",
      name: "test-job",
      job_spec: { agent_configs: [] },
      job_source: { scenario_ids: ["s3"] },
    } as any;

    const params = buildCloneParams(job);
    expect(params.cloneSourceType).toBe("scenarios");
    expect(params.initialScenarioIds).toBe("s3");
  });

  it("falls back to job_source benchmark_id", () => {
    const job = {
      id: "bj_4",
      name: "test-job",
      job_spec: { agent_configs: [] },
      job_source: { benchmark_id: "bm_2" },
    } as any;

    const params = buildCloneParams(job);
    expect(params.cloneSourceType).toBe("benchmark");
    expect(params.initialBenchmarkIds).toBe("bm_2");
  });

  it("extracts agent configs with secrets", () => {
    const job = {
      id: "bj_5",
      name: "test-job",
      job_spec: {
        benchmark_id: "bm_1",
        agent_configs: [
          {
            agent_id: "ag_1",
            name: "agent-1",
            model_name: "gpt-4",
            timeout_seconds: 300,
            kwargs: { key: "val" },
            agent_environment: {
              secrets: { API_KEY: "secret-ref" },
              environment_variables: { ENV: "prod" },
            },
          },
        ],
      },
    } as any;

    const params = buildCloneParams(job);
    const configs = JSON.parse(params.cloneAgentConfigs);
    expect(configs).toHaveLength(1);
    expect(configs[0].agentId).toBe("ag_1");
    expect(configs[0].name).toBe("agent-1");
    expect(configs[0].modelName).toBe("gpt-4");
    expect(configs[0].timeoutSeconds).toBe(300);
    expect(configs[0].kwargs).toEqual({ key: "val" });
    expect(configs[0].secrets).toEqual({ API_KEY: "secret-ref" });
    expect(configs[0].environmentVariables).toEqual({ ENV: "prod" });
  });

  it("extracts agent configs with secret_names (legacy)", () => {
    const job = {
      id: "bj_6",
      name: "test-job",
      job_spec: {
        benchmark_id: "bm_1",
        agent_configs: [
          {
            agent_id: "ag_1",
            name: "agent-1",
            agent_environment: {
              secret_names: ["MY_SECRET"],
            },
          },
        ],
      },
    } as any;

    const params = buildCloneParams(job);
    const configs = JSON.parse(params.cloneAgentConfigs);
    expect(configs[0].secrets).toEqual(["MY_SECRET"]);
  });

  it("extracts agent configs with secret_refs (object)", () => {
    const job = {
      id: "bj_7",
      name: "test-job",
      job_spec: {
        benchmark_id: "bm_1",
        agent_configs: [
          {
            agent_id: "ag_1",
            name: "agent-1",
            agent_environment: {
              secret_refs: { KEY: "ref_123" },
            },
          },
        ],
      },
    } as any;

    const params = buildCloneParams(job);
    const configs = JSON.parse(params.cloneAgentConfigs);
    expect(configs[0].secrets).toEqual({ KEY: "ref_123" });
  });

  it("extracts orchestrator config", () => {
    const job = {
      id: "bj_8",
      name: "test-job",
      job_spec: {
        benchmark_id: "bm_1",
        agent_configs: [],
        orchestrator_config: {
          n_attempts: 3,
          n_concurrent_trials: 2,
          quiet: true,
          timeout_multiplier: 1.5,
        },
      },
    } as any;

    const params = buildCloneParams(job);
    const orch = JSON.parse(params.cloneOrchestratorConfig);
    expect(orch.nAttempts).toBe(3);
    expect(orch.nConcurrentTrials).toBe(2);
    expect(orch.quiet).toBe(true);
    expect(orch.timeoutMultiplier).toBe(1.5);
  });

  it("handles minimal job (no configs)", () => {
    const job = {
      id: "bj_9",
      name: "minimal-job",
      job_spec: null,
    } as any;

    const params = buildCloneParams(job);
    expect(params.cloneFromJobId).toBe("bj_9");
    expect(params.cloneJobName).toBe("minimal-job");
    expect(params.cloneAgentConfigs).toBeUndefined();
    expect(params.cloneOrchestratorConfig).toBeUndefined();
  });

  it("handles null name", () => {
    const job = {
      id: "bj_10",
      name: null,
      job_spec: null,
    } as any;

    const params = buildCloneParams(job);
    expect(params.cloneJobName).toBe("");
  });

  it("extracts legacy agent IDs and names", () => {
    const job = {
      id: "bj_11",
      name: "test-job",
      job_spec: {
        benchmark_id: "bm_1",
        agent_configs: [
          { agent_id: "ag_1", name: "first" },
          { agent_id: "ag_2", name: "second" },
        ],
      },
    } as any;

    const params = buildCloneParams(job);
    expect(params.cloneAgentIds).toBe("ag_1,ag_2");
    expect(params.cloneAgentNames).toBe("first,second");
  });
});

describe("createBenchmarkJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates with benchmarkId", async () => {
    const mockJob = { id: "bj_new" };
    mockCreate.mockResolvedValue(mockJob);

    const result = await createBenchmarkJob({
      benchmarkId: "bm_1",
      agentConfigs: [{ name: "agent-1" }],
    });

    expect(result).toEqual(mockJob);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: expect.objectContaining({
          type: "benchmark",
          benchmark_id: "bm_1",
        }),
      }),
    );
  });

  it("creates with scenarioIds", async () => {
    const mockJob = { id: "bj_new" };
    mockCreate.mockResolvedValue(mockJob);

    await createBenchmarkJob({
      scenarioIds: ["s1", "s2"],
      agentConfigs: [{ name: "agent-1" }],
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: expect.objectContaining({
          type: "scenarios",
          scenario_ids: ["s1", "s2"],
        }),
      }),
    );
  });

  it("throws when neither benchmarkId nor scenarioIds provided", async () => {
    await expect(
      createBenchmarkJob({ agentConfigs: [{ name: "agent-1" }] }),
    ).rejects.toThrow("Either benchmarkId or scenarioIds must be provided");
  });

  it("throws when both benchmarkId and scenarioIds provided", async () => {
    await expect(
      createBenchmarkJob({
        benchmarkId: "bm_1",
        scenarioIds: ["s1"],
        agentConfigs: [{ name: "agent-1" }],
      }),
    ).rejects.toThrow("Cannot specify both");
  });

  it("maps agent config fields correctly", async () => {
    mockCreate.mockResolvedValue({ id: "bj_new" });

    await createBenchmarkJob({
      benchmarkId: "bm_1",
      agentConfigs: [
        {
          name: "my-agent",
          agentId: "ag_1",
          modelName: "gpt-4",
          timeoutSeconds: 300,
          kwargs: { temp: "0.5" },
          environmentVariables: { ENV: "test" },
          secrets: { KEY: "val" },
        },
      ],
    });

    const spec = mockCreate.mock.calls[0][0].spec;
    const agentConfig = spec.agent_configs[0];
    expect(agentConfig.name).toBe("my-agent");
    expect(agentConfig.agent_id).toBe("ag_1");
    expect(agentConfig.model_name).toBe("gpt-4");
    expect(agentConfig.timeout_seconds).toBe(300);
    expect(agentConfig.kwargs).toEqual({ temp: "0.5" });
    expect(agentConfig.agent_environment.environment_variables).toEqual({
      ENV: "test",
    });
    expect(agentConfig.agent_environment.secrets).toEqual({ KEY: "val" });
  });

  it("omits empty kwargs", async () => {
    mockCreate.mockResolvedValue({ id: "bj_new" });

    await createBenchmarkJob({
      benchmarkId: "bm_1",
      agentConfigs: [{ name: "my-agent", kwargs: {} }],
    });

    const agentConfig = mockCreate.mock.calls[0][0].spec.agent_configs[0];
    expect(agentConfig.kwargs).toBeUndefined();
  });

  it("includes orchestrator config when provided", async () => {
    mockCreate.mockResolvedValue({ id: "bj_new" });

    await createBenchmarkJob({
      benchmarkId: "bm_1",
      agentConfigs: [{ name: "agent-1" }],
      orchestratorConfig: {
        nAttempts: 3,
        nConcurrentTrials: 2,
        quiet: true,
        timeoutMultiplier: 1.5,
      },
    });

    const spec = mockCreate.mock.calls[0][0].spec;
    expect(spec.orchestrator_config).toEqual({
      n_attempts: 3,
      n_concurrent_trials: 2,
      quiet: true,
      timeout_multiplier: 1.5,
    });
  });

  it("includes job name when provided", async () => {
    mockCreate.mockResolvedValue({ id: "bj_new" });

    await createBenchmarkJob({
      name: "my-job",
      benchmarkId: "bm_1",
      agentConfigs: [{ name: "agent-1" }],
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "my-job" }),
    );
  });
});

describe("listBenchmarkJobs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes pagination params", async () => {
    mockList.mockResolvedValue({ jobs: [], has_more: false });

    await listBenchmarkJobs({
      limit: 10,
      startingAfter: "bj_cursor",
      name: "test",
      includeTotalCount: true,
    });

    expect(mockList).toHaveBeenCalledWith({
      limit: 10,
      starting_after: "bj_cursor",
      name: "test",
      include_total_count: true,
    });
  });

  it("defaults include_total_count to false when not specified", async () => {
    mockList.mockResolvedValue({ jobs: [], has_more: false });

    await listBenchmarkJobs({ limit: 10 });

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ include_total_count: false }),
    );
  });

  it("returns jobs with hasMore and totalCount", async () => {
    mockList.mockResolvedValue({
      jobs: [{ id: "bj_1" }],
      has_more: true,
      total_count: 42,
    });

    const result = await listBenchmarkJobs({ limit: 10 });
    expect(result.jobs).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.totalCount).toBe(42);
  });
});

describe("getBenchmarkJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retrieves by id", async () => {
    const mockJob = { id: "bj_1", name: "test" };
    mockRetrieve.mockResolvedValue(mockJob);

    const result = await getBenchmarkJob("bj_1");
    expect(result).toEqual(mockJob);
    expect(mockRetrieve).toHaveBeenCalledWith("bj_1");
  });
});

describe("getBenchmarkRun", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retrieves by id", async () => {
    const mockRun = { id: "br_1", name: "test-run" };
    mockBenchmarkRunsRetrieve.mockResolvedValue(mockRun);

    const result = await getBenchmarkRun("br_1");
    expect(result).toEqual(mockRun);
    expect(mockBenchmarkRunsRetrieve).toHaveBeenCalledWith("br_1");
  });
});

describe("listBenchmarkRunScenarioRuns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("paginates through all scenario runs", async () => {
    const runs = [{ id: "sr_1" }, { id: "sr_2" }, { id: "sr_3" }];
    mockBenchmarkRunsListScenarioRuns.mockReturnValue({
      [Symbol.asyncIterator]: () => {
        let i = 0;
        return {
          next: async () =>
            i < runs.length
              ? { value: runs[i++], done: false }
              : { value: undefined, done: true },
        };
      },
    });

    const result = await listBenchmarkRunScenarioRuns("br_1");
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("sr_1");
    expect(result[2].id).toBe("sr_3");
    expect(mockBenchmarkRunsListScenarioRuns).toHaveBeenCalledWith("br_1", {
      limit: 100,
    });
  });

  it("passes additional options", async () => {
    mockBenchmarkRunsListScenarioRuns.mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        next: async () => ({ value: undefined, done: true }),
      }),
    });

    await listBenchmarkRunScenarioRuns("br_1", { limit: 50 } as any);
    expect(mockBenchmarkRunsListScenarioRuns).toHaveBeenCalledWith("br_1", {
      limit: 50,
    });
  });

  it("returns empty array when no runs", async () => {
    mockBenchmarkRunsListScenarioRuns.mockReturnValue({
      [Symbol.asyncIterator]: () => ({
        next: async () => ({ value: undefined, done: true }),
      }),
    });

    const result = await listBenchmarkRunScenarioRuns("br_1");
    expect(result).toEqual([]);
  });
});

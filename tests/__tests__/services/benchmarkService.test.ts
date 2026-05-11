import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockBenchmarkRunsList = jest.fn();
const mockBenchmarkRunsRetrieve = jest.fn();
const mockBenchmarkRunsListScenarioRuns = jest.fn();
const mockBenchmarkRunsCreate = jest.fn();
const mockScenarioRunsList = jest.fn();
const mockScenarioRunsRetrieve = jest.fn();
const mockBenchmarksList = jest.fn();
const mockBenchmarksRetrieve = jest.fn();
const mockBenchmarksListPublic = jest.fn();

jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    benchmarkRuns: {
      list: mockBenchmarkRunsList,
      retrieve: mockBenchmarkRunsRetrieve,
      listScenarioRuns: mockBenchmarkRunsListScenarioRuns,
      create: mockBenchmarkRunsCreate,
    },
    scenarios: {
      runs: {
        list: mockScenarioRunsList,
        retrieve: mockScenarioRunsRetrieve,
      },
    },
    benchmarks: {
      list: mockBenchmarksList,
      retrieve: mockBenchmarksRetrieve,
      listPublic: mockBenchmarksListPublic,
    },
  }),
}));

const {
  listBenchmarkRuns,
  getBenchmarkRun,
  listScenarioRuns,
  getScenarioRun,
  listBenchmarks,
  getBenchmark,
  listPublicBenchmarks,
  createBenchmarkRun,
} = await import("@/services/benchmarkService.js");

describe("listScenarioRuns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("with benchmarkRunId uses benchmarkRuns.listScenarioRuns endpoint", async () => {
    mockBenchmarkRunsListScenarioRuns.mockResolvedValue({
      runs: [{ id: "sr_1" }],
      has_more: false,
      total_count: 1,
    });

    const result = await listScenarioRuns({
      limit: 10,
      benchmarkRunId: "br_1",
    });

    expect(mockBenchmarkRunsListScenarioRuns).toHaveBeenCalledWith("br_1", {
      limit: 10,
      include_total_count: false,
    });
    expect(mockScenarioRunsList).not.toHaveBeenCalled();
    expect(result.scenarioRuns).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it("without benchmarkRunId uses scenarios.runs.list endpoint", async () => {
    mockScenarioRunsList.mockResolvedValue({
      runs: [{ id: "sr_2" }],
      has_more: true,
      total_count: 50,
    });

    const result = await listScenarioRuns({ limit: 10 });

    expect(mockScenarioRunsList).toHaveBeenCalledWith({
      limit: 10,
      include_total_count: false,
    });
    expect(mockBenchmarkRunsListScenarioRuns).not.toHaveBeenCalled();
    expect(result.scenarioRuns).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });

  it("passes startingAfter and includeTotalCount", async () => {
    mockScenarioRunsList.mockResolvedValue({
      runs: [],
      has_more: false,
    });

    await listScenarioRuns({
      limit: 10,
      startingAfter: "sr_cursor",
      includeTotalCount: true,
    });

    expect(mockScenarioRunsList).toHaveBeenCalledWith({
      limit: 10,
      starting_after: "sr_cursor",
      include_total_count: true,
    });
  });

  it("passes startingAfter with benchmarkRunId path", async () => {
    mockBenchmarkRunsListScenarioRuns.mockResolvedValue({
      runs: [],
      has_more: false,
    });

    await listScenarioRuns({
      limit: 10,
      benchmarkRunId: "br_1",
      startingAfter: "sr_cursor",
      includeTotalCount: true,
    });

    expect(mockBenchmarkRunsListScenarioRuns).toHaveBeenCalledWith("br_1", {
      limit: 10,
      starting_after: "sr_cursor",
      include_total_count: true,
    });
  });
});

describe("listPublicBenchmarks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls benchmarks.listPublic", async () => {
    mockBenchmarksListPublic.mockResolvedValue({
      benchmarks: [{ id: "bm_pub" }],
      has_more: false,
      total_count: 1,
    });

    const result = await listPublicBenchmarks({ limit: 10 });
    expect(mockBenchmarksListPublic).toHaveBeenCalled();
    expect(result.benchmarks).toHaveLength(1);
  });

  it("passes search param", async () => {
    mockBenchmarksListPublic.mockResolvedValue({
      benchmarks: [],
      has_more: false,
    });

    await listPublicBenchmarks({ limit: 10, search: "code-review" });

    expect(mockBenchmarksListPublic).toHaveBeenCalledWith(
      expect.objectContaining({ search: "code-review" }),
    );
  });

  it("passes startingAfter for pagination", async () => {
    mockBenchmarksListPublic.mockResolvedValue({
      benchmarks: [],
      has_more: false,
    });

    await listPublicBenchmarks({
      limit: 10,
      startingAfter: "bm_cursor",
      includeTotalCount: true,
    });

    expect(mockBenchmarksListPublic).toHaveBeenCalledWith(
      expect.objectContaining({
        starting_after: "bm_cursor",
        include_total_count: true,
      }),
    );
  });
});

describe("createBenchmarkRun", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends benchmark_ids array", async () => {
    const mockRun = { id: "br_new" };
    mockBenchmarkRunsCreate.mockResolvedValue(mockRun);

    const result = await createBenchmarkRun(["bm_1", "bm_2"]);
    expect(result).toEqual(mockRun);
    expect(mockBenchmarkRunsCreate).toHaveBeenCalledWith({
      benchmark_ids: ["bm_1", "bm_2"],
    });
  });

  it("includes optional name and metadata", async () => {
    mockBenchmarkRunsCreate.mockResolvedValue({ id: "br_new" });

    await createBenchmarkRun(["bm_1"], {
      name: "my-run",
      metadata: { env: "staging" },
    });

    expect(mockBenchmarkRunsCreate).toHaveBeenCalledWith({
      benchmark_ids: ["bm_1"],
      name: "my-run",
      metadata: { env: "staging" },
    });
  });

  it("omits name and metadata when not provided", async () => {
    mockBenchmarkRunsCreate.mockResolvedValue({ id: "br_new" });

    await createBenchmarkRun(["bm_1"]);

    const callArgs = mockBenchmarkRunsCreate.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty("name");
    expect(callArgs).not.toHaveProperty("metadata");
  });
});

describe("listBenchmarkRuns", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes pagination params", async () => {
    mockBenchmarkRunsList.mockResolvedValue({
      runs: [],
      has_more: false,
    });

    await listBenchmarkRuns({
      limit: 10,
      startingAfter: "br_cursor",
      includeTotalCount: true,
    });

    expect(mockBenchmarkRunsList).toHaveBeenCalledWith({
      limit: 10,
      starting_after: "br_cursor",
      include_total_count: true,
    });
  });

  it("returns benchmarkRuns, totalCount, hasMore", async () => {
    mockBenchmarkRunsList.mockResolvedValue({
      runs: [{ id: "br_1" }],
      has_more: true,
      total_count: 30,
    });

    const result = await listBenchmarkRuns({ limit: 10 });
    expect(result.benchmarkRuns).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.totalCount).toBe(30);
  });
});

describe("getBenchmarkRun", () => {
  it("retrieves by id", async () => {
    const mockRun = { id: "br_1" };
    mockBenchmarkRunsRetrieve.mockResolvedValue(mockRun);

    const result = await getBenchmarkRun("br_1");
    expect(result).toEqual(mockRun);
    expect(mockBenchmarkRunsRetrieve).toHaveBeenCalledWith("br_1");
  });
});

describe("getScenarioRun", () => {
  it("retrieves by id", async () => {
    const mockRun = { id: "sr_1" };
    mockScenarioRunsRetrieve.mockResolvedValue(mockRun);

    const result = await getScenarioRun("sr_1");
    expect(result).toEqual(mockRun);
    expect(mockScenarioRunsRetrieve).toHaveBeenCalledWith("sr_1");
  });
});

describe("listBenchmarks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes search and pagination params", async () => {
    mockBenchmarksList.mockResolvedValue({
      benchmarks: [],
      has_more: false,
    });

    await listBenchmarks({
      limit: 10,
      search: "test",
      startingAfter: "bm_cursor",
      includeTotalCount: true,
    });

    expect(mockBenchmarksList).toHaveBeenCalledWith({
      limit: 10,
      search: "test",
      starting_after: "bm_cursor",
      include_total_count: true,
    });
  });
});

describe("getBenchmark", () => {
  it("retrieves by id", async () => {
    const mockBenchmark = { id: "bm_1" };
    mockBenchmarksRetrieve.mockResolvedValue(mockBenchmark);

    const result = await getBenchmark("bm_1");
    expect(result).toEqual(mockBenchmark);
  });
});

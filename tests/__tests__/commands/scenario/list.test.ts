import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockListScenarioRuns = jest.fn();
jest.unstable_mockModule("@/services/benchmarkService.js", () => ({
  listScenarioRuns: mockListScenarioRuns,
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
const mockParseLimit = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
  parseLimit: mockParseLimit,
}));

const { listScenarioRunsCommand } = await import(
  "@/commands/scenario/list.js"
);

describe("listScenarioRunsCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParseLimit.mockReturnValue(Infinity);
  });

  it("outputs runs via output() with defaultFormat json", async () => {
    const runs = [
      { id: "sr_1", name: "run-1", state: "completed", start_time_ms: 1000 },
    ];
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: runs,
      hasMore: false,
    });

    await listScenarioRunsCommand({});

    expect(mockOutput).toHaveBeenCalledWith(runs, {
      format: undefined,
      defaultFormat: "json",
    });
  });

  it("fetches multiple pages when hasMore is true", async () => {
    mockListScenarioRuns
      .mockResolvedValueOnce({
        scenarioRuns: [
          { id: "sr_1", name: "run-1", state: "completed", start_time_ms: 1000 },
        ],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        scenarioRuns: [
          { id: "sr_2", name: "run-2", state: "completed", start_time_ms: 2000 },
        ],
        hasMore: false,
      });

    await listScenarioRunsCommand({});

    expect(mockListScenarioRuns).toHaveBeenCalledTimes(2);
    expect(mockListScenarioRuns).toHaveBeenLastCalledWith(
      expect.objectContaining({ startingAfter: "sr_1" }),
    );
  });

  it("stops fetching when limit is reached", async () => {
    mockParseLimit.mockReturnValue(1);
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: [
        { id: "sr_1", name: "run-1", state: "completed", start_time_ms: 1000 },
      ],
      hasMore: true,
    });

    await listScenarioRunsCommand({ limit: "1" });

    expect(mockListScenarioRuns).toHaveBeenCalledTimes(1);
  });

  it("sorts results by start_time_ms ascending", async () => {
    const runs = [
      { id: "sr_2", name: "run-2", state: "completed", start_time_ms: 2000 },
      { id: "sr_1", name: "run-1", state: "completed", start_time_ms: 1000 },
    ];
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: runs,
      hasMore: false,
    });

    await listScenarioRunsCommand({});

    const outputData = mockOutput.mock.calls[0][0] as typeof runs;
    expect(outputData[0].id).toBe("sr_1");
    expect(outputData[1].id).toBe("sr_2");
  });

  it("passes format option through to output()", async () => {
    const runs = [
      { id: "sr_1", name: "run-1", state: "completed", start_time_ms: 1000 },
    ];
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: runs,
      hasMore: false,
    });

    await listScenarioRunsCommand({ output: "json" });

    expect(mockOutput).toHaveBeenCalledWith(runs, {
      format: "json",
      defaultFormat: "json",
    });
  });

  it("passes benchmarkRunId filter", async () => {
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: [],
      hasMore: false,
    });

    await listScenarioRunsCommand({ benchmarkRunId: "br_1" });

    expect(mockListScenarioRuns).toHaveBeenCalledWith(
      expect.objectContaining({ benchmarkRunId: "br_1" }),
    );
  });

  it("handles API error gracefully", async () => {
    const error = new Error("Network error");
    mockListScenarioRuns.mockRejectedValue(error);

    await listScenarioRunsCommand({});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to list scenario runs",
      error,
    );
  });

  it("adjusts page size based on limit", async () => {
    mockParseLimit.mockReturnValue(5);
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: [
        { id: "sr_1", name: "run-1", state: "completed", start_time_ms: 1000 },
      ],
      hasMore: false,
    });

    await listScenarioRunsCommand({ limit: "5" });

    expect(mockListScenarioRuns).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 }),
    );
  });
});

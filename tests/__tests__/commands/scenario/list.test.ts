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

jest.unstable_mockModule("@/utils/time.js", () => ({
  formatTimeAgo: jest.fn((ms: number) => "1h ago"),
}));

const { listScenarioRunsCommand } = await import(
  "@/commands/scenario/list.js"
);

describe("listScenarioRunsCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (console.log as jest.Mock).mockClear();
    mockParseLimit.mockReturnValue(Infinity);
  });

  it("prints 'No scenario runs found' for empty results", async () => {
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: [],
      hasMore: false,
    });

    await listScenarioRunsCommand({});

    const allOutput = (console.log as jest.Mock).mock.calls
      .map((c: any[]) => String(c[0]))
      .join("\n");
    expect(allOutput).toContain("No scenario runs found");
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
    // Second call uses cursor from first page's last item
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
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: [
        { id: "sr_2", name: "run-2", state: "completed", start_time_ms: 2000 },
        { id: "sr_1", name: "run-1", state: "completed", start_time_ms: 1000 },
      ],
      hasMore: false,
    });

    await listScenarioRunsCommand({});

    // First data row should be sr_1 (earlier start_time_ms)
    const calls = (console.log as jest.Mock).mock.calls;
    const dataRow1 = String(calls[2][0]);
    expect(dataRow1).toContain("sr_1");
  });

  it("uses output() for JSON format", async () => {
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

  it("shows table with runs", async () => {
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: [
        {
          id: "sr_1",
          name: "run-1",
          state: "completed",
          start_time_ms: 1700000000000,
          scoring_contract_result: { score: 0.85 },
        },
      ],
      hasMore: false,
    });

    await listScenarioRunsCommand({});

    const calls = (console.log as jest.Mock).mock.calls;
    // Header, separator, 1 data row, blank line, count
    expect(calls.length).toBeGreaterThanOrEqual(4);
    const allOutput = calls.map((c: any[]) => String(c[0])).join("\n");
    expect(allOutput).toContain("sr_1");
    expect(allOutput).toContain("1 run");
  });

  it("shows singular 'run' for single result", async () => {
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: [
        { id: "sr_1", name: "run-1", state: "completed", start_time_ms: 1000 },
      ],
      hasMore: false,
    });

    await listScenarioRunsCommand({});

    const allOutput = (console.log as jest.Mock).mock.calls
      .map((c: any[]) => String(c[0]))
      .join("\n");
    expect(allOutput).toContain("1 run");
    expect(allOutput).not.toContain("1 runs");
  });

  it("shows plural 'runs' for multiple results", async () => {
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: [
        { id: "sr_1", name: "run-1", state: "completed", start_time_ms: 1000 },
        { id: "sr_2", name: "run-2", state: "completed", start_time_ms: 2000 },
      ],
      hasMore: false,
    });

    await listScenarioRunsCommand({});

    const allOutput = (console.log as jest.Mock).mock.calls
      .map((c: any[]) => String(c[0]))
      .join("\n");
    expect(allOutput).toContain("2 runs");
  });

  it("handles null start_time_ms with N/A", async () => {
    mockListScenarioRuns.mockResolvedValue({
      scenarioRuns: [
        { id: "sr_1", name: "run-1", state: "completed", start_time_ms: undefined },
      ],
      hasMore: false,
    });

    await listScenarioRunsCommand({});

    const allOutput = (console.log as jest.Mock).mock.calls
      .map((c: any[]) => String(c[0]))
      .join("\n");
    expect(allOutput).toContain("N/A");
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

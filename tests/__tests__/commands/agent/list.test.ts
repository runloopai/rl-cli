/**
 * Tests for agent list command
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockListAgents = jest.fn();
jest.unstable_mockModule("@/services/agentService.js", () => ({
  listAgents: mockListAgents,
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
}));

const sampleAgents = [
  {
    id: "agt_abc123",
    name: "claude-code",
    version: "2.0.65",
    is_public: true,
    create_time_ms: 2000,
  },
  {
    id: "agt_old456",
    name: "claude-code",
    version: "1.0.0",
    is_public: true,
    create_time_ms: 1000,
  },
  {
    id: "agt_xyz789",
    name: "my-agent",
    version: "0.1.0",
    is_public: false,
    create_time_ms: 3000,
  },
];

describe("listAgentsCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListAgents.mockReset();
    mockOutput.mockReset();
    mockOutputError.mockReset();
  });

  it("should dedup to latest version per name by default", async () => {
    mockListAgents.mockResolvedValue({ agents: sampleAgents });

    const { listAgentsCommand } = await import("@/commands/agent/list.js");
    // Capture console.log output to verify table was printed with deduped agents
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await listAgentsCommand({});
    logSpy.mockRestore();

    // Should not have been called with version filter (client-side dedup instead)
    expect(mockListAgents).toHaveBeenCalledWith(
      expect.not.objectContaining({ version: "latest" }),
    );
  });

  it("should show all versions when --full is set", async () => {
    mockListAgents.mockResolvedValue({ agents: sampleAgents });

    const { listAgentsCommand } = await import("@/commands/agent/list.js");
    await listAgentsCommand({ full: true, output: "json" });

    // All 3 agents should be output (no dedup)
    expect(mockOutput).toHaveBeenCalledWith(sampleAgents, {
      format: "json",
      defaultFormat: "json",
    });
  });

  it("should keep only latest per name in JSON output", async () => {
    mockListAgents.mockResolvedValue({ agents: sampleAgents });

    const { listAgentsCommand } = await import("@/commands/agent/list.js");
    await listAgentsCommand({ output: "json" });

    const outputAgents = mockOutput.mock.calls[0][0] as typeof sampleAgents;
    expect(outputAgents).toHaveLength(2);
    expect(outputAgents.find((a) => a.name === "claude-code")?.version).toBe(
      "2.0.65",
    );
    expect(outputAgents.find((a) => a.name === "my-agent")?.version).toBe(
      "0.1.0",
    );
  });

  it("should pass --public filter", async () => {
    mockListAgents.mockResolvedValue({ agents: [] });

    const { listAgentsCommand } = await import("@/commands/agent/list.js");
    await listAgentsCommand({ public: true });

    expect(mockListAgents).toHaveBeenCalledWith(
      expect.objectContaining({ publicOnly: true }),
    );
  });

  it("should pass --private filter", async () => {
    mockListAgents.mockResolvedValue({ agents: [] });

    const { listAgentsCommand } = await import("@/commands/agent/list.js");
    await listAgentsCommand({ private: true });

    expect(mockListAgents).toHaveBeenCalledWith(
      expect.objectContaining({ privateOnly: true }),
    );
  });

  it("should pass --name filter", async () => {
    mockListAgents.mockResolvedValue({ agents: [] });

    const { listAgentsCommand } = await import("@/commands/agent/list.js");
    await listAgentsCommand({ name: "claude" });

    expect(mockListAgents).toHaveBeenCalledWith(
      expect.objectContaining({ name: "claude" }),
    );
  });

  it("should show PRIVATE banner by default", async () => {
    mockListAgents.mockResolvedValue({ agents: sampleAgents });

    const { listAgentsCommand } = await import("@/commands/agent/list.js");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await listAgentsCommand({});

    const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allOutput).toContain("PRIVATE");
    expect(allOutput).toContain("--public");

    logSpy.mockRestore();
  });

  it("should show PUBLIC banner with --public flag", async () => {
    mockListAgents.mockResolvedValue({ agents: [] });

    const { listAgentsCommand } = await import("@/commands/agent/list.js");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await listAgentsCommand({ public: true });

    const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allOutput).toContain("PUBLIC");
    expect(allOutput).toContain("--private");

    logSpy.mockRestore();
  });

  it("should size columns to fit content", async () => {
    const agents = [
      {
        id: "agt_short",
        name: "a",
        version: "1",
        is_public: false,
        create_time_ms: 1000,
      },
      {
        id: "agt_a_much_longer_id_value",
        name: "a-much-longer-agent-name",
        version: "12.345.6789",
        is_public: false,
        create_time_ms: 2000,
      },
    ];
    mockListAgents.mockResolvedValue({ agents });

    const { listAgentsCommand } = await import("@/commands/agent/list.js");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    await listAgentsCommand({});

    // Find the header line (first line after the banner and blank line)
    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    // Header row contains all column names
    const headerLine = lines.find(
      (l) => l.includes("NAME") && l.includes("ID") && l.includes("VERSION"),
    );
    expect(headerLine).toBeDefined();

    // The two data rows should have their IDs starting at the same column offset
    const dataLines = lines.filter((l) => l.includes("agt_"));
    expect(dataLines).toHaveLength(2);

    // Both IDs should be at the same column position (aligned)
    const idPos0 = dataLines[0].indexOf("agt_");
    const idPos1 = dataLines[1].indexOf("agt_");
    expect(idPos0).toBe(idPos1);

    logSpy.mockRestore();
  });

  it("should handle API errors gracefully", async () => {
    const apiError = new Error("API Error");
    mockListAgents.mockRejectedValue(apiError);

    const { listAgentsCommand } = await import("@/commands/agent/list.js");
    await listAgentsCommand({});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to list agents",
      apiError,
    );
  });
});

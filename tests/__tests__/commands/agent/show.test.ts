/**
 * Tests for agent show command
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockGetAgent = jest.fn();
const mockListAgents = jest.fn();
jest.unstable_mockModule("@/services/agentService.js", () => ({
  getAgent: mockGetAgent,
  listAgents: mockListAgents,
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
}));

const sampleAgent = {
  id: "agt_abc123",
  name: "claude-code",
  version: "2.0.65",
  is_public: true,
  create_time_ms: Date.now(),
};

describe("showAgentCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should retrieve by ID when input starts with agt_", async () => {
    mockGetAgent.mockResolvedValue(sampleAgent);

    const { showAgentCommand } = await import("@/commands/agent/show.js");
    await showAgentCommand("agt_abc123", {});

    expect(mockGetAgent).toHaveBeenCalledWith("agt_abc123");
    expect(mockListAgents).not.toHaveBeenCalled();
    expect(mockOutput).toHaveBeenCalledWith(sampleAgent, {
      format: undefined,
      defaultFormat: "json",
    });
  });

  it("should look up by name and return latest version", async () => {
    const older = { ...sampleAgent, id: "agt_old", version: "1.0.0", create_time_ms: 1000 };
    const newer = { ...sampleAgent, id: "agt_new", version: "2.0.0", create_time_ms: 2000 };
    mockListAgents.mockResolvedValue({
      agents: [older, newer],
    });

    const { showAgentCommand } = await import("@/commands/agent/show.js");
    await showAgentCommand("claude-code", {});

    expect(mockGetAgent).not.toHaveBeenCalled();
    expect(mockListAgents).toHaveBeenCalledWith({ name: "claude-code" });
    expect(mockOutput).toHaveBeenCalledWith(newer, {
      format: undefined,
      defaultFormat: "json",
    });
  });

  it("should error when name not found", async () => {
    mockListAgents.mockResolvedValue({ agents: [] });

    const { showAgentCommand } = await import("@/commands/agent/show.js");
    await showAgentCommand("nonexistent", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to get agent",
      expect.any(Error),
    );
  });

  it("should filter out partial name matches", async () => {
    // API returns partial matches; we only want exact
    const partial = { ...sampleAgent, name: "claude-code-extended" };
    mockListAgents.mockResolvedValue({ agents: [partial] });

    const { showAgentCommand } = await import("@/commands/agent/show.js");
    await showAgentCommand("claude-code", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to get agent",
      expect.any(Error),
    );
  });

  it("should output in requested format", async () => {
    mockGetAgent.mockResolvedValue(sampleAgent);

    const { showAgentCommand } = await import("@/commands/agent/show.js");
    await showAgentCommand("agt_abc123", { output: "json" });

    expect(mockOutput).toHaveBeenCalledWith(sampleAgent, {
      format: "json",
      defaultFormat: "json",
    });
  });

  it("should handle API errors gracefully", async () => {
    const apiError = new Error("API Error");
    mockGetAgent.mockRejectedValue(apiError);

    const { showAgentCommand } = await import("@/commands/agent/show.js");
    await showAgentCommand("agt_abc123", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to get agent",
      apiError,
    );
  });
});

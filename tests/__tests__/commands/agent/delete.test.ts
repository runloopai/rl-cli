/**
 * Tests for agent delete command
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockGetAgent = jest.fn();
const mockListAgents = jest.fn();
const mockDeleteAgent = jest.fn();
jest.unstable_mockModule("@/services/agentService.js", () => ({
  getAgent: mockGetAgent,
  listAgents: mockListAgents,
  deleteAgent: mockDeleteAgent,
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
}));

const mockPrintAgentTable = jest.fn();
jest.unstable_mockModule("@/commands/agent/list.js", () => ({
  printAgentTable: mockPrintAgentTable,
}));

// Mock readline to simulate user confirmation
const mockQuestion = jest.fn();
const mockClose = jest.fn();
jest.unstable_mockModule("readline", () => ({
  default: {
    createInterface: () => ({
      question: mockQuestion,
      close: mockClose,
    }),
  },
}));

const sampleAgent = {
  id: "agt_abc123",
  name: "my-agent",
  version: "1.0.0",
  is_public: false,
  create_time_ms: Date.now(),
};

describe("deleteAgentCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAgent.mockReset();
    mockListAgents.mockReset();
    mockDeleteAgent.mockReset();
    mockOutput.mockReset();
    mockOutputError.mockReset();
    mockPrintAgentTable.mockReset();
    mockQuestion.mockReset();
    mockClose.mockReset();
  });

  it("should delete by ID with --yes flag", async () => {
    mockGetAgent.mockResolvedValue(sampleAgent);
    mockDeleteAgent.mockResolvedValue(undefined);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { deleteAgentCommand } = await import("@/commands/agent/delete.js");
    await deleteAgentCommand("agt_abc123", { yes: true });

    logSpy.mockRestore();

    expect(mockGetAgent).toHaveBeenCalledWith("agt_abc123");
    expect(mockDeleteAgent).toHaveBeenCalledWith("agt_abc123");
    expect(mockQuestion).not.toHaveBeenCalled();
  });

  it("should resolve name to ID before deleting", async () => {
    mockListAgents.mockResolvedValue({
      agents: [sampleAgent],
    });
    mockDeleteAgent.mockResolvedValue(undefined);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { deleteAgentCommand } = await import("@/commands/agent/delete.js");
    await deleteAgentCommand("my-agent", { yes: true });

    logSpy.mockRestore();

    expect(mockListAgents).toHaveBeenCalledWith({ name: "my-agent" });
    expect(mockDeleteAgent).toHaveBeenCalledWith("agt_abc123");
  });

  it("should list matches and not delete when name matches multiple", async () => {
    const older = { ...sampleAgent, id: "agt_old", create_time_ms: 1000 };
    const newer = { ...sampleAgent, id: "agt_new", create_time_ms: 2000 };
    mockListAgents.mockResolvedValue({ agents: [older, newer] });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { deleteAgentCommand } = await import("@/commands/agent/delete.js");
    await deleteAgentCommand("my-agent", { yes: true });

    const allOutput = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(allOutput).toContain("Multiple agents found");
    expect(allOutput).toContain("Delete by ID");
    expect(mockPrintAgentTable).toHaveBeenCalledWith([older, newer]);
    expect(mockDeleteAgent).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("should prompt for confirmation without --yes", async () => {
    mockGetAgent.mockResolvedValue(sampleAgent);
    mockDeleteAgent.mockResolvedValue(undefined);
    mockQuestion.mockImplementation((_msg: unknown, cb: unknown) => {
      (cb as (answer: string) => void)("y");
    });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { deleteAgentCommand } = await import("@/commands/agent/delete.js");
    await deleteAgentCommand("agt_abc123", {});

    logSpy.mockRestore();

    expect(mockQuestion).toHaveBeenCalled();
    expect(mockDeleteAgent).toHaveBeenCalledWith("agt_abc123");
  });

  it("should cancel when user declines confirmation", async () => {
    mockGetAgent.mockResolvedValue(sampleAgent);
    mockQuestion.mockImplementation((_msg: unknown, cb: unknown) => {
      (cb as (answer: string) => void)("n");
    });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { deleteAgentCommand } = await import("@/commands/agent/delete.js");
    await deleteAgentCommand("agt_abc123", {});

    logSpy.mockRestore();

    expect(mockDeleteAgent).not.toHaveBeenCalled();
  });

  it("should output JSON format when requested", async () => {
    mockGetAgent.mockResolvedValue(sampleAgent);
    mockDeleteAgent.mockResolvedValue(undefined);

    const { deleteAgentCommand } = await import("@/commands/agent/delete.js");
    await deleteAgentCommand("agt_abc123", { yes: true, output: "json" });

    expect(mockOutput).toHaveBeenCalledWith(
      { deleted: true, id: "agt_abc123", name: "my-agent" },
      { format: "json", defaultFormat: "json" },
    );
  });

  it("should error when name not found", async () => {
    mockListAgents.mockResolvedValue({ agents: [] });

    const { deleteAgentCommand } = await import("@/commands/agent/delete.js");
    await deleteAgentCommand("nonexistent", { yes: true });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to delete agent",
      expect.objectContaining({
        message: expect.stringContaining("No agent found"),
      }),
    );
    expect(mockDeleteAgent).not.toHaveBeenCalled();
  });

  it("should handle API errors gracefully", async () => {
    const apiError = new Error("API Error");
    mockGetAgent.mockResolvedValue(sampleAgent);
    mockDeleteAgent.mockRejectedValue(apiError);

    const { deleteAgentCommand } = await import("@/commands/agent/delete.js");
    await deleteAgentCommand("agt_abc123", { yes: true });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to delete agent",
      apiError,
    );
  });
});

/**
 * Tests for agent create command
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockCreateAgent = jest.fn();
jest.unstable_mockModule("@/services/agentService.js", () => ({
  createAgent: mockCreateAgent,
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
}));

const sampleAgent = {
  id: "agt_abc123",
  name: "my-agent",
  version: "1.0.0",
  is_public: false,
  create_time_ms: Date.now(),
};

describe("createAgentCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateAgent.mockReset();
    mockOutput.mockReset();
    mockOutputError.mockReset();
  });

  it("should create an npm agent with required options", async () => {
    mockCreateAgent.mockResolvedValue(sampleAgent);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "npm",
      package: "my-npm-package",
    });

    logSpy.mockRestore();

    expect(mockCreateAgent).toHaveBeenCalledWith({
      name: "my-agent",
      version: "1.0.0",
      source: {
        type: "npm",
        npm: {
          package_name: "my-npm-package",
          registry_url: undefined,
          agent_setup: undefined,
        },
      },
    });
  });

  it("should error when npm source missing --package", async () => {
    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "npm",
    });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to create agent",
      expect.objectContaining({
        message: expect.stringContaining("--package is required"),
      }),
    );
    expect(mockCreateAgent).not.toHaveBeenCalled();
  });

  it("should create a pip agent", async () => {
    mockCreateAgent.mockResolvedValue(sampleAgent);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "pip",
      package: "my-pip-package",
      registryUrl: "https://custom.pypi.org/simple",
    });

    logSpy.mockRestore();

    expect(mockCreateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          type: "pip",
          pip: {
            package_name: "my-pip-package",
            registry_url: "https://custom.pypi.org/simple",
            agent_setup: undefined,
          },
        },
      }),
    );
  });

  it("should error when pip source missing --package", async () => {
    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "pip",
    });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to create agent",
      expect.objectContaining({
        message: expect.stringContaining("--package is required"),
      }),
    );
  });

  it("should create a git agent", async () => {
    mockCreateAgent.mockResolvedValue(sampleAgent);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "git",
      repository: "https://github.com/org/repo",
      ref: "main",
    });

    logSpy.mockRestore();

    expect(mockCreateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          type: "git",
          git: {
            repository: "https://github.com/org/repo",
            ref: "main",
            agent_setup: undefined,
          },
        },
      }),
    );
  });

  it("should error when git source missing --repository", async () => {
    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "git",
    });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to create agent",
      expect.objectContaining({
        message: expect.stringContaining("--repository is required"),
      }),
    );
  });

  it("should create an object agent", async () => {
    mockCreateAgent.mockResolvedValue(sampleAgent);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "object",
      objectId: "obj_12345",
    });

    logSpy.mockRestore();

    expect(mockCreateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: {
          type: "object",
          object: {
            object_id: "obj_12345",
            agent_setup: undefined,
          },
        },
      }),
    );
  });

  it("should error when object source missing --object-id", async () => {
    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "object",
    });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to create agent",
      expect.objectContaining({
        message: expect.stringContaining("--object-id is required"),
      }),
    );
  });

  it("should error on unknown source type", async () => {
    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "docker",
    });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to create agent",
      expect.objectContaining({
        message: expect.stringContaining("Unknown source type: docker"),
      }),
    );
  });

  it("should output JSON format when requested", async () => {
    mockCreateAgent.mockResolvedValue(sampleAgent);

    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "npm",
      package: "my-pkg",
      output: "json",
    });

    expect(mockOutput).toHaveBeenCalledWith(sampleAgent, {
      format: "json",
      defaultFormat: "json",
    });
  });

  it("should print text summary on success", async () => {
    mockCreateAgent.mockResolvedValue(sampleAgent);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "npm",
      package: "my-pkg",
    });

    const allOutput = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(allOutput).toContain("Agent created successfully");
    expect(allOutput).toContain("my-agent");
    expect(allOutput).toContain("agt_abc123");

    logSpy.mockRestore();
  });

  it("should handle API errors gracefully", async () => {
    const apiError = new Error("API Error");
    mockCreateAgent.mockRejectedValue(apiError);

    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "npm",
      package: "my-pkg",
    });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to create agent",
      apiError,
    );
  });

  it("should pass setup commands through", async () => {
    mockCreateAgent.mockResolvedValue(sampleAgent);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { createAgentCommand } = await import("@/commands/agent/create.js");
    await createAgentCommand({
      name: "my-agent",
      agentVersion: "1.0.0",
      source: "npm",
      package: "my-pkg",
      setupCommands: ["npm install", "npm run build"],
    });

    logSpy.mockRestore();

    expect(mockCreateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          npm: expect.objectContaining({
            agent_setup: ["npm install", "npm run build"],
          }),
        }),
      }),
    );
  });
});

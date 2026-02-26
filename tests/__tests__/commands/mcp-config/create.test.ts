/**
 * Tests for MCP config create command
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockCreate = jest.fn();
jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    mcpConfigs: {
      create: mockCreate,
    },
  }),
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
}));

describe("createMcpConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (console.log as jest.Mock).mockClear();
    mockCreate.mockReset();
    mockOutput.mockReset();
    mockOutputError.mockReset();
  });

  it("should create an MCP config with valid options", async () => {
    const mockConfig = { id: "mcp_abc123", name: "test-config" };
    mockCreate.mockResolvedValue(mockConfig);

    const { createMcpConfig } = await import(
      "@/commands/mcp-config/create.js"
    );
    await createMcpConfig({
      name: "test-config",
      endpoint: "https://mcp.example.com",
      allowedTools: "*",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      name: "test-config",
      endpoint: "https://mcp.example.com",
      allowed_tools: ["*"],
      description: undefined,
    });
    expect(console.log).toHaveBeenCalledWith("mcp_abc123");
  });

  it("should pass description when provided", async () => {
    const mockConfig = { id: "mcp_desc" };
    mockCreate.mockResolvedValue(mockConfig);

    const { createMcpConfig } = await import(
      "@/commands/mcp-config/create.js"
    );
    await createMcpConfig({
      name: "test",
      endpoint: "https://mcp.example.com",
      allowedTools: "*",
      description: "My config",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ description: "My config" }),
    );
  });

  it("should parse comma-separated allowed tools", async () => {
    const mockConfig = { id: "mcp_tools" };
    mockCreate.mockResolvedValue(mockConfig);

    const { createMcpConfig } = await import(
      "@/commands/mcp-config/create.js"
    );
    await createMcpConfig({
      name: "test",
      endpoint: "https://mcp.example.com",
      allowedTools: "github.search_*, github.get_*",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        allowed_tools: ["github.search_*", "github.get_*"],
      }),
    );
  });

  it("should output JSON format when requested", async () => {
    const mockConfig = { id: "mcp_json" };
    mockCreate.mockResolvedValue(mockConfig);

    const { createMcpConfig } = await import(
      "@/commands/mcp-config/create.js"
    );
    await createMcpConfig({
      name: "test",
      endpoint: "https://mcp.example.com",
      allowedTools: "*",
      output: "json",
    });

    expect(mockOutput).toHaveBeenCalledWith(mockConfig, {
      format: "json",
      defaultFormat: "json",
    });
    expect(console.log).not.toHaveBeenCalled();
  });

  it("should report validation errors for invalid endpoint", async () => {
    const { createMcpConfig } = await import(
      "@/commands/mcp-config/create.js"
    );
    await createMcpConfig({
      name: "test",
      endpoint: "not-a-url",
      allowedTools: "*",
    });

    expect(mockOutputError).toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should handle API errors gracefully", async () => {
    const apiError = new Error("API Error");
    mockCreate.mockRejectedValue(apiError);

    const { createMcpConfig } = await import(
      "@/commands/mcp-config/create.js"
    );
    await createMcpConfig({
      name: "test",
      endpoint: "https://mcp.example.com",
      allowedTools: "*",
    });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to create MCP config",
      apiError,
    );
  });
});

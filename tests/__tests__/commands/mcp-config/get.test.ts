/**
 * Tests for MCP config get command
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockGetByIdOrName = jest.fn();
jest.unstable_mockModule("@/services/mcpConfigService.js", () => ({
  getMcpConfigByIdOrName: mockGetByIdOrName,
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
}));

describe("getMcpConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetByIdOrName.mockReset();
    mockOutput.mockReset();
    mockOutputError.mockReset();
  });

  it("should get an MCP config by ID", async () => {
    const mockConfig = {
      id: "mcp_abc123",
      name: "test",
      endpoint: "https://mcp.example.com",
      allowed_tools: ["*"],
    };
    mockGetByIdOrName.mockResolvedValue(mockConfig);

    const { getMcpConfig } = await import("@/commands/mcp-config/get.js");
    await getMcpConfig({ id: "mcp_abc123" });

    expect(mockGetByIdOrName).toHaveBeenCalledWith("mcp_abc123");
    expect(mockOutput).toHaveBeenCalledWith(mockConfig, {
      format: undefined,
      defaultFormat: "json",
    });
  });

  it("should get an MCP config by name", async () => {
    const mockConfig = { id: "mcp_byname", name: "my-config" };
    mockGetByIdOrName.mockResolvedValue(mockConfig);

    const { getMcpConfig } = await import("@/commands/mcp-config/get.js");
    await getMcpConfig({ id: "my-config" });

    expect(mockGetByIdOrName).toHaveBeenCalledWith("my-config");
    expect(mockOutput).toHaveBeenCalledWith(mockConfig, {
      format: undefined,
      defaultFormat: "json",
    });
  });

  it("should report error when config not found", async () => {
    mockGetByIdOrName.mockResolvedValue(null);

    const { getMcpConfig } = await import("@/commands/mcp-config/get.js");
    await getMcpConfig({ id: "nonexistent" });

    expect(mockOutputError).toHaveBeenCalledWith(
      "MCP config not found: nonexistent",
    );
    expect(mockOutput).not.toHaveBeenCalled();
  });

  it("should output in requested format", async () => {
    const mockConfig = { id: "mcp_yaml" };
    mockGetByIdOrName.mockResolvedValue(mockConfig);

    const { getMcpConfig } = await import("@/commands/mcp-config/get.js");
    await getMcpConfig({ id: "mcp_yaml", output: "yaml" });

    expect(mockOutput).toHaveBeenCalledWith(mockConfig, {
      format: "yaml",
      defaultFormat: "json",
    });
  });

  it("should handle API errors gracefully", async () => {
    const apiError = new Error("API Error");
    mockGetByIdOrName.mockRejectedValue(apiError);

    const { getMcpConfig } = await import("@/commands/mcp-config/get.js");
    await getMcpConfig({ id: "mcp_error" });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to get MCP config",
      apiError,
    );
  });
});

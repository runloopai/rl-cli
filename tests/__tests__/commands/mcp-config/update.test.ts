/**
 * Tests for MCP config update command
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockUpdate = jest.fn();
jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    mcpConfigs: {
      update: mockUpdate,
    },
  }),
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
}));

describe("updateMcpConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (console.log as jest.Mock).mockClear();
    mockUpdate.mockReset();
    mockOutput.mockReset();
    mockOutputError.mockReset();
  });

  it("should update name", async () => {
    const mockConfig = { id: "mcp_abc123", name: "updated-name" };
    mockUpdate.mockResolvedValue(mockConfig);

    const { updateMcpConfig } = await import(
      "@/commands/mcp-config/update.js"
    );
    await updateMcpConfig({ id: "mcp_abc123", name: "updated-name" });

    expect(mockUpdate).toHaveBeenCalledWith("mcp_abc123", {
      name: "updated-name",
    });
    expect(console.log).toHaveBeenCalledWith("mcp_abc123");
  });

  it("should update endpoint", async () => {
    const mockConfig = { id: "mcp_ep" };
    mockUpdate.mockResolvedValue(mockConfig);

    const { updateMcpConfig } = await import(
      "@/commands/mcp-config/update.js"
    );
    await updateMcpConfig({
      id: "mcp_ep",
      endpoint: "https://new-endpoint.example.com",
    });

    expect(mockUpdate).toHaveBeenCalledWith("mcp_ep", {
      endpoint: "https://new-endpoint.example.com",
    });
  });

  it("should update allowed tools", async () => {
    const mockConfig = { id: "mcp_tools" };
    mockUpdate.mockResolvedValue(mockConfig);

    const { updateMcpConfig } = await import(
      "@/commands/mcp-config/update.js"
    );
    await updateMcpConfig({
      id: "mcp_tools",
      allowedTools: "github.search_*, github.get_*",
    });

    expect(mockUpdate).toHaveBeenCalledWith("mcp_tools", {
      allowed_tools: ["github.search_*", "github.get_*"],
    });
  });

  it("should update multiple fields at once", async () => {
    const mockConfig = { id: "mcp_multi" };
    mockUpdate.mockResolvedValue(mockConfig);

    const { updateMcpConfig } = await import(
      "@/commands/mcp-config/update.js"
    );
    await updateMcpConfig({
      id: "mcp_multi",
      name: "new-name",
      endpoint: "https://new.example.com",
      description: "new desc",
    });

    expect(mockUpdate).toHaveBeenCalledWith("mcp_multi", {
      name: "new-name",
      endpoint: "https://new.example.com",
      description: "new desc",
    });
  });

  it("should report error when no update options provided", async () => {
    const { updateMcpConfig } = await import(
      "@/commands/mcp-config/update.js"
    );
    await updateMcpConfig({ id: "mcp_empty" });

    expect(mockOutputError).toHaveBeenCalledWith(
      expect.stringContaining("No update options provided"),
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should report validation errors for invalid endpoint", async () => {
    const { updateMcpConfig } = await import(
      "@/commands/mcp-config/update.js"
    );
    await updateMcpConfig({ id: "mcp_bad", endpoint: "not-a-url" });

    expect(mockOutputError).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("should output JSON format when requested", async () => {
    const mockConfig = { id: "mcp_json" };
    mockUpdate.mockResolvedValue(mockConfig);

    const { updateMcpConfig } = await import(
      "@/commands/mcp-config/update.js"
    );
    await updateMcpConfig({
      id: "mcp_json",
      name: "new",
      output: "json",
    });

    expect(mockOutput).toHaveBeenCalledWith(mockConfig, {
      format: "json",
      defaultFormat: "json",
    });
    expect(console.log).not.toHaveBeenCalled();
  });

  it("should handle API errors gracefully", async () => {
    const apiError = new Error("API Error");
    mockUpdate.mockRejectedValue(apiError);

    const { updateMcpConfig } = await import(
      "@/commands/mcp-config/update.js"
    );
    await updateMcpConfig({ id: "mcp_err", name: "new" });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to update MCP config",
      apiError,
    );
  });
});

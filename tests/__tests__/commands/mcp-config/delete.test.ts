/**
 * Tests for MCP config delete command
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockDelete = jest.fn();
jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    mcpConfigs: {
      delete: mockDelete,
    },
  }),
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
}));

describe("deleteMcpConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (console.log as jest.Mock).mockClear();
    mockDelete.mockReset();
    mockOutput.mockReset();
    mockOutputError.mockReset();
  });

  it("should delete an MCP config by ID", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteMcpConfig } = await import(
      "@/commands/mcp-config/delete.js"
    );
    await deleteMcpConfig("mcp_abc123", {});

    expect(mockDelete).toHaveBeenCalledWith("mcp_abc123");
    expect(console.log).toHaveBeenCalledWith("mcp_abc123");
  });

  it("should output JSON format when requested", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteMcpConfig } = await import(
      "@/commands/mcp-config/delete.js"
    );
    await deleteMcpConfig("mcp_json", { output: "json" });

    expect(mockDelete).toHaveBeenCalledWith("mcp_json");
    expect(mockOutput).toHaveBeenCalledWith(
      { id: "mcp_json", status: "deleted" },
      { format: "json", defaultFormat: "json" },
    );
    expect(console.log).not.toHaveBeenCalledWith("mcp_json");
  });

  it("should output YAML format when requested", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteMcpConfig } = await import(
      "@/commands/mcp-config/delete.js"
    );
    await deleteMcpConfig("mcp_yaml", { output: "yaml" });

    expect(mockOutput).toHaveBeenCalledWith(
      { id: "mcp_yaml", status: "deleted" },
      { format: "yaml", defaultFormat: "json" },
    );
  });

  it("should output just the ID in text format (default)", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteMcpConfig } = await import(
      "@/commands/mcp-config/delete.js"
    );
    await deleteMcpConfig("mcp_text", { output: "text" });

    expect(console.log).toHaveBeenCalledWith("mcp_text");
    expect(mockOutput).not.toHaveBeenCalled();
  });

  it("should output just the ID when no output option is provided", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteMcpConfig } = await import(
      "@/commands/mcp-config/delete.js"
    );
    await deleteMcpConfig("mcp_default", {});

    expect(console.log).toHaveBeenCalledWith("mcp_default");
    expect(mockOutput).not.toHaveBeenCalled();
  });

  it("should handle API errors gracefully", async () => {
    const apiError = new Error("API Error: Not Found");
    mockDelete.mockRejectedValue(apiError);

    const { deleteMcpConfig } = await import(
      "@/commands/mcp-config/delete.js"
    );
    await deleteMcpConfig("mcp_error", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to delete MCP config",
      apiError,
    );
  });
});

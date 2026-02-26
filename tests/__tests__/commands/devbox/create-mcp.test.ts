/**
 * Tests for devbox create --mcp flag
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockCreate = jest.fn();
jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    devboxes: {
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

describe("createDevbox --mcp flag", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (console.log as jest.Mock).mockClear();
    mockCreate.mockReset();
    mockOutput.mockReset();
    mockOutputError.mockReset();
  });

  it("should pass MCP specs to create request", async () => {
    const mockDevbox = { id: "dbx_mcp_test" };
    mockCreate.mockResolvedValue(mockDevbox);

    const { createDevbox } = await import("@/commands/devbox/create.js");
    await createDevbox({
      mcp: ["github-readonly,my_secret"],
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mcp: [{ mcp_config: "github-readonly", secret: "my_secret" }],
      }),
    );
    expect(console.log).toHaveBeenCalledWith("dbx_mcp_test");
  });

  it("should handle multiple MCP specs", async () => {
    const mockDevbox = { id: "dbx_multi_mcp" };
    mockCreate.mockResolvedValue(mockDevbox);

    const { createDevbox } = await import("@/commands/devbox/create.js");
    await createDevbox({
      mcp: ["github-readonly,secret1", "jira-config,secret2"],
    });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mcp: [
          { mcp_config: "github-readonly", secret: "secret1" },
          { mcp_config: "jira-config", secret: "secret2" },
        ],
      }),
    );
  });

  it("should not include mcp field when no --mcp provided", async () => {
    const mockDevbox = { id: "dbx_no_mcp" };
    mockCreate.mockResolvedValue(mockDevbox);

    const { createDevbox } = await import("@/commands/devbox/create.js");
    await createDevbox({});

    const createArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(createArg.mcp).toBeUndefined();
  });

  it("should report error for invalid MCP spec format (missing comma)", async () => {
    const { createDevbox } = await import("@/commands/devbox/create.js");
    await createDevbox({
      mcp: ["invalid-no-comma"],
    });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to create devbox",
      expect.any(Error),
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should combine MCP with other options", async () => {
    const mockDevbox = { id: "dbx_combo" };
    mockCreate.mockResolvedValue(mockDevbox);

    const { createDevbox } = await import("@/commands/devbox/create.js");
    await createDevbox({
      name: "my-devbox",
      mcp: ["github-readonly,my_secret"],
      blueprint: "my-blueprint",
    });

    const createArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
    expect(createArg.name).toBe("my-devbox");
    expect(createArg.blueprint_name).toBe("my-blueprint");
    expect(createArg.mcp).toEqual([
      { mcp_config: "github-readonly", secret: "my_secret" },
    ]);
  });
});

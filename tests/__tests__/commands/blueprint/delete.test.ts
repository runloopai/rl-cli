/**
 * Tests for blueprint delete command
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock dependencies using the path alias
const mockDelete = jest.fn();
jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    blueprints: {
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

describe("deleteBlueprint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (console.log as jest.Mock).mockClear();
    mockDelete.mockReset();
    mockOutput.mockReset();
    mockOutputError.mockReset();
  });

  it("should delete a blueprint by ID", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import("@/commands/blueprint/delete.js");
    await deleteBlueprint("bpt_abc123", {});

    expect(mockDelete).toHaveBeenCalledWith("bpt_abc123");
    expect(console.log).toHaveBeenCalledWith("bpt_abc123");
  });

  it("should output JSON format when requested", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import("@/commands/blueprint/delete.js");
    await deleteBlueprint("bpt_json123", { output: "json" });

    expect(mockDelete).toHaveBeenCalledWith("bpt_json123");
    expect(mockOutput).toHaveBeenCalledWith(
      { id: "bpt_json123", status: "deleted" },
      { format: "json", defaultFormat: "json" },
    );
    expect(console.log).not.toHaveBeenCalledWith("bpt_json123");
  });

  it("should output YAML format when requested", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import("@/commands/blueprint/delete.js");
    await deleteBlueprint("bpt_yaml456", { output: "yaml" });

    expect(mockDelete).toHaveBeenCalledWith("bpt_yaml456");
    expect(mockOutput).toHaveBeenCalledWith(
      { id: "bpt_yaml456", status: "deleted" },
      { format: "yaml", defaultFormat: "json" },
    );
  });

  it("should output just the ID in text format (default)", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import("@/commands/blueprint/delete.js");
    await deleteBlueprint("bpt_text789", { output: "text" });

    expect(console.log).toHaveBeenCalledWith("bpt_text789");
    expect(mockOutput).not.toHaveBeenCalled();
  });

  it("should output just the ID when no output option is provided", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import("@/commands/blueprint/delete.js");
    await deleteBlueprint("bpt_default", {});

    expect(console.log).toHaveBeenCalledWith("bpt_default");
    expect(mockOutput).not.toHaveBeenCalled();
  });

  it("should handle API errors gracefully", async () => {
    const apiError = new Error("API Error: Forbidden");
    mockDelete.mockRejectedValue(apiError);

    const { deleteBlueprint } = await import("@/commands/blueprint/delete.js");
    await deleteBlueprint("bpt_error", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to delete blueprint",
      apiError,
    );
  });

  it("should handle dependent snapshot errors gracefully", async () => {
    const apiError = new Error(
      "Blueprint has dependent snapshots and cannot be deleted",
    );
    mockDelete.mockRejectedValue(apiError);

    const { deleteBlueprint } = await import("@/commands/blueprint/delete.js");
    await deleteBlueprint("bpt_has_snapshots", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to delete blueprint",
      apiError,
    );
  });
});

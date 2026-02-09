/**
 * Tests for blueprint delete command
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock dependencies using the path alias
const mockDelete = jest.fn();
const mockList = jest.fn();
jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    blueprints: {
      delete: mockDelete,
      list: mockList,
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
    mockList.mockReset();
    mockOutput.mockReset();
    mockOutputError.mockReset();
  });

  it("should delete a blueprint by ID directly", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("bpt_abc123", {});

    expect(mockList).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith("bpt_abc123");
    expect(console.log).toHaveBeenCalledWith("bpt_abc123");
  });

  it("should resolve blueprint by name and delete", async () => {
    mockList.mockResolvedValue({
      blueprints: [{ id: "bpt_resolved", name: "my-blueprint" }],
    });
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("my-blueprint", {});

    expect(mockList).toHaveBeenCalledWith({ name: "my-blueprint" });
    expect(mockDelete).toHaveBeenCalledWith("bpt_resolved");
    expect(console.log).toHaveBeenCalledWith("bpt_resolved");
  });

  it("should prefer exact name match when resolving by name", async () => {
    mockList.mockResolvedValue({
      blueprints: [
        { id: "bpt_partial", name: "my-blueprint-v2" },
        { id: "bpt_exact", name: "my-blueprint" },
      ],
    });
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("my-blueprint", {});

    expect(mockDelete).toHaveBeenCalledWith("bpt_exact");
    expect(console.log).toHaveBeenCalledWith("bpt_exact");
  });

  it("should fall back to first result when no exact name match", async () => {
    mockList.mockResolvedValue({
      blueprints: [
        { id: "bpt_first", name: "my-blueprint-v1" },
        { id: "bpt_second", name: "my-blueprint-v2" },
      ],
    });
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("my-blueprint", {});

    expect(mockDelete).toHaveBeenCalledWith("bpt_first");
    expect(console.log).toHaveBeenCalledWith("bpt_first");
  });

  it("should output error when blueprint name is not found", async () => {
    mockList.mockResolvedValue({ blueprints: [] });

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("nonexistent-blueprint", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Blueprint not found: nonexistent-blueprint",
      expect.any(Error),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("should handle empty blueprints array from API", async () => {
    mockList.mockResolvedValue({});

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("nonexistent", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Blueprint not found: nonexistent",
      expect.any(Error),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("should output JSON format when requested", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
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

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("bpt_yaml456", { output: "yaml" });

    expect(mockDelete).toHaveBeenCalledWith("bpt_yaml456");
    expect(mockOutput).toHaveBeenCalledWith(
      { id: "bpt_yaml456", status: "deleted" },
      { format: "yaml", defaultFormat: "json" },
    );
  });

  it("should output just the ID in text format (default)", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("bpt_text789", { output: "text" });

    expect(console.log).toHaveBeenCalledWith("bpt_text789");
    expect(mockOutput).not.toHaveBeenCalled();
  });

  it("should output just the ID when no output option is provided", async () => {
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("bpt_default", {});

    expect(console.log).toHaveBeenCalledWith("bpt_default");
    expect(mockOutput).not.toHaveBeenCalled();
  });

  it("should handle API errors on delete gracefully", async () => {
    const apiError = new Error("API Error: Forbidden");
    mockDelete.mockRejectedValue(apiError);

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("bpt_error", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to delete blueprint",
      apiError,
    );
  });

  it("should handle API errors on list gracefully", async () => {
    const apiError = new Error("API Error: Network failure");
    mockList.mockRejectedValue(apiError);

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("some-name", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to delete blueprint",
      apiError,
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("should output resolved ID in text format when deleting by name", async () => {
    mockList.mockResolvedValue({
      blueprints: [{ id: "bpt_resolved_id", name: "named-blueprint" }],
    });
    mockDelete.mockResolvedValue(undefined);

    const { deleteBlueprint } = await import(
      "@/commands/blueprint/delete.js"
    );
    await deleteBlueprint("named-blueprint", { output: "json" });

    expect(mockOutput).toHaveBeenCalledWith(
      { id: "bpt_resolved_id", status: "deleted" },
      { format: "json", defaultFormat: "json" },
    );
  });
});

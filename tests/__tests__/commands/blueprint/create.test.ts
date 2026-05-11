import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockRetrieve = jest.fn();
const mockList = jest.fn();
const mockCreate = jest.fn();

jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    blueprints: {
      retrieve: mockRetrieve,
      list: mockList,
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

jest.unstable_mockModule("fs/promises", () => ({
  readFile: jest
    .fn<() => Promise<string>>()
    .mockResolvedValue("FROM ubuntu:22.04\nRUN echo hello"),
}));

const { createBlueprint } = await import("@/commands/blueprint/create.js");

describe("createBlueprint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("without --base", () => {
    it("creates a blueprint with name and options", async () => {
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ name: "my-bp", resources: "LARGE" });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "my-bp",
          launch_parameters: { resource_size_request: "LARGE" },
        }),
      );
    });

    it("errors when --name is missing and no --base", async () => {
      await createBlueprint({});

      expect(mockOutputError).toHaveBeenCalledWith(
        "--name is required (or use --base to derive one)",
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("with --base", () => {
    const sourceBlueprint = {
      id: "bpt_abc",
      name: "my-blueprint",
      parameters: {
        name: "my-blueprint",
        dockerfile: "FROM ubuntu:22.04",
        system_setup_commands: ["apt install curl"],
        launch_parameters: { keep_alive_time_seconds: 3600 },
        secrets: { API_KEY: "ref_123" },
        file_mounts: { "/data": "content" },
        code_mounts: [{ repo_name: "test", repo_owner: "owner" }],
      },
      metadata: { env: "staging" },
    };

    it("looks up base by ID when starts with bpt_", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_abc" });

      expect(mockRetrieve).toHaveBeenCalledWith("bpt_abc");
      expect(mockList).not.toHaveBeenCalled();
    });

    it("looks up base by name", async () => {
      mockList.mockResolvedValue({ blueprints: [sourceBlueprint] });
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "my-blueprint" });

      expect(mockList).toHaveBeenCalledWith({ name: "my-blueprint" });
      expect(mockRetrieve).not.toHaveBeenCalled();
    });

    it("uses exact name match when available", async () => {
      const other = {
        ...sourceBlueprint,
        id: "bpt_other",
        name: "my-blueprint-v2",
      };
      mockList.mockResolvedValue({ blueprints: [other, sourceBlueprint] });
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "my-blueprint" });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ base_blueprint_id: "bpt_abc" }),
      );
    });

    it("falls back to first result when no exact match", async () => {
      const fuzzy = {
        ...sourceBlueprint,
        id: "bpt_fuzzy",
        name: "my-blueprint-v2",
      };
      mockList.mockResolvedValue({ blueprints: [fuzzy] });
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "my-blueprint" });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ base_blueprint_id: "bpt_fuzzy" }),
      );
    });

    it("errors when base not found", async () => {
      mockList.mockResolvedValue({ blueprints: [] });

      await createBlueprint({ base: "nonexistent" });

      expect(mockOutputError).toHaveBeenCalledWith(
        "Base blueprint not found: nonexistent",
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("defaults name to {base}-copy", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_abc" });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "my-blueprint-copy" }),
      );
    });

    it("uses fallback name when base has no name", async () => {
      mockRetrieve.mockResolvedValue({ ...sourceBlueprint, name: "" });
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_abc" });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "blueprint-copy" }),
      );
    });

    it("custom name via --name overrides default", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_abc", name: "custom-name" });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ name: "custom-name" }),
      );
    });

    it("copies all source parameters when no overrides given", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_abc" });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call).toEqual(
        expect.objectContaining({
          name: "my-blueprint-copy",
          base_blueprint_id: "bpt_abc",
          system_setup_commands: ["apt install curl"],
          launch_parameters: { keep_alive_time_seconds: 3600 },
          secrets: { API_KEY: "ref_123" },
          file_mounts: { "/data": "content" },
          code_mounts: [{ repo_name: "test", repo_owner: "owner" }],
          metadata: { env: "staging" },
        }),
      );
      expect(call.dockerfile).toBeUndefined();
    });

    it("handles base with no parameters", async () => {
      mockRetrieve.mockResolvedValue({
        id: "bpt_min",
        name: "minimal",
        parameters: undefined,
        metadata: undefined,
      });
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_min" });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "minimal-copy",
          base_blueprint_id: "bpt_min",
        }),
      );
    });

    it("overrides resources via --resources", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_abc", resources: "LARGE" });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call.launch_parameters.resource_size_request).toBe("LARGE");
      expect(call.base_blueprint_id).toBe("bpt_abc");
    });

    it("overrides architecture", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_abc", architecture: "x86_64" });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call.launch_parameters.architecture).toBe("x86_64");
    });

    it("overrides system-setup-commands", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({
        base: "bpt_abc",
        systemSetupCommands: ["apt install git"],
      });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call.system_setup_commands).toEqual(["apt install git"]);
    });

    it("overrides metadata via --metadata", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({
        base: "bpt_abc",
        metadata: ["env=production", "team=infra"],
      });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call.metadata).toEqual({ env: "production", team: "infra" });
    });

    it("falls back to source metadata when no --metadata override", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_abc" });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call.metadata).toEqual({ env: "staging" });
    });

    it("--dockerfile replaces base_blueprint_id (mutually exclusive)", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({
        base: "bpt_abc",
        dockerfile: "FROM node:20\nRUN npm install",
      });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call.dockerfile).toBe("FROM node:20\nRUN npm install");
      expect(call.base_blueprint_id).toBeUndefined();
    });

    it("--dockerfile-path replaces base_blueprint_id", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({
        base: "bpt_abc",
        dockerfilePath: "/path/to/Dockerfile",
      });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call.dockerfile).toBe("FROM ubuntu:22.04\nRUN echo hello");
      expect(call.base_blueprint_id).toBeUndefined();
    });

    it("overrides available-ports", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({
        base: "bpt_abc",
        availablePorts: ["8080", "3000"],
      });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call.launch_parameters.available_ports).toEqual([8080, 3000]);
    });

    it("overrides user via --root", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_abc", root: true });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call.launch_parameters.user_parameters).toEqual({
        username: "root",
        uid: 0,
      });
    });

    it("overrides user via --user", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_abc", user: "appuser:1001" });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call.launch_parameters.user_parameters).toEqual({
        username: "appuser",
        uid: 1001,
      });
    });

    it("preserves source params not covered by overrides", async () => {
      mockRetrieve.mockResolvedValue(sourceBlueprint);
      mockCreate.mockResolvedValue({ id: "bpt_new" });

      await createBlueprint({ base: "bpt_abc", resources: "SMALL" });

      const call = mockCreate.mock.calls[0]![0] as any;
      expect(call.secrets).toEqual({ API_KEY: "ref_123" });
      expect(call.file_mounts).toEqual({ "/data": "content" });
      expect(call.code_mounts).toEqual([
        { repo_name: "test", repo_owner: "owner" },
      ]);
    });
  });

  it("outputs in default json format", async () => {
    const newBlueprint = { id: "bpt_new", name: "my-bp" };
    mockCreate.mockResolvedValue(newBlueprint);

    await createBlueprint({ name: "my-bp" });

    expect(mockOutput).toHaveBeenCalledWith(newBlueprint, {
      format: undefined,
      defaultFormat: "json",
    });
  });

  it("outputs in custom format when specified", async () => {
    mockCreate.mockResolvedValue({ id: "bpt_new" });

    await createBlueprint({ name: "my-bp", output: "yaml" });

    expect(mockOutput).toHaveBeenCalledWith(expect.anything(), {
      format: "yaml",
      defaultFormat: "json",
    });
  });

  it("handles API error gracefully", async () => {
    const error = new Error("API error");
    mockCreate.mockRejectedValue(error);

    await createBlueprint({ name: "my-bp" });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to create blueprint",
      error,
    );
  });
});

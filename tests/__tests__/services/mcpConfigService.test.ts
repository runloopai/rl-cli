/**
 * Tests for MCP config service layer
 */
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockList = jest.fn();
const mockRetrieve = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    mcpConfigs: {
      list: mockList,
      retrieve: mockRetrieve,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  }),
}));

const baseMcpConfigView = {
  id: "mcp_abc123",
  name: "test-config",
  description: "A test config",
  endpoint: "https://mcp.example.com",
  create_time_ms: 1700000000000,
  allowed_tools: ["github.search_*", "github.get_*"],
};

describe("mcpConfigService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockReset();
    mockRetrieve.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
  });

  describe("listMcpConfigs", () => {
    it("forwards pagination params to API", async () => {
      mockList.mockResolvedValue({
        mcp_configs: [],
        has_more: false,
      });

      const { listMcpConfigs } = await import(
        "@/services/mcpConfigService.js"
      );
      await listMcpConfigs({ limit: 10, startingAfter: "mcp_xyz" });

      expect(mockList).toHaveBeenCalledWith({
        limit: 10,
        starting_after: "mcp_xyz",
      });
    });

    it("maps search param to name query", async () => {
      mockList.mockResolvedValue({
        mcp_configs: [],
        has_more: false,
      });

      const { listMcpConfigs } = await import(
        "@/services/mcpConfigService.js"
      );
      await listMcpConfigs({ limit: 10, search: "my-config" });

      expect(mockList).toHaveBeenCalledWith({
        limit: 10,
        name: "my-config",
      });
    });

    it("maps response to McpConfig array", async () => {
      mockList.mockResolvedValue({
        mcp_configs: [baseMcpConfigView],
        has_more: true,
      });

      const { listMcpConfigs } = await import(
        "@/services/mcpConfigService.js"
      );
      const result = await listMcpConfigs({ limit: 10 });

      expect(result.mcpConfigs).toHaveLength(1);
      expect(result.mcpConfigs[0].id).toBe("mcp_abc123");
      expect(result.mcpConfigs[0].name).toBe("test-config");
      expect(result.mcpConfigs[0].endpoint).toBe("https://mcp.example.com");
      expect(result.mcpConfigs[0].allowed_tools).toEqual([
        "github.search_*",
        "github.get_*",
      ]);
      expect(result.hasMore).toBe(true);
    });

    it("handles empty results", async () => {
      mockList.mockResolvedValue({
        mcp_configs: [],
        has_more: false,
      });

      const { listMcpConfigs } = await import(
        "@/services/mcpConfigService.js"
      );
      const result = await listMcpConfigs({ limit: 10 });

      expect(result.mcpConfigs).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it("truncates long field values", async () => {
      const longName = "x".repeat(300);
      mockList.mockResolvedValue({
        mcp_configs: [{ ...baseMcpConfigView, name: longName }],
        has_more: false,
      });

      const { listMcpConfigs } = await import(
        "@/services/mcpConfigService.js"
      );
      const result = await listMcpConfigs({ limit: 10 });

      expect(result.mcpConfigs[0].name.length).toBeLessThanOrEqual(200);
    });

    it("handles non-array allowed_tools in list response", async () => {
      mockList.mockResolvedValue({
        mcp_configs: [{ ...baseMcpConfigView, allowed_tools: "not-an-array" }],
        has_more: false,
      });

      const { listMcpConfigs } = await import(
        "@/services/mcpConfigService.js"
      );
      const result = await listMcpConfigs({ limit: 10 });

      expect(result.mcpConfigs[0].allowed_tools).toEqual([]);
    });
  });

  describe("getMcpConfig", () => {
    it("retrieves config by ID and maps fields", async () => {
      mockRetrieve.mockResolvedValue(baseMcpConfigView);

      const { getMcpConfig } = await import("@/services/mcpConfigService.js");
      const config = await getMcpConfig("mcp_abc123");

      expect(mockRetrieve).toHaveBeenCalledWith("mcp_abc123");
      expect(config.id).toBe("mcp_abc123");
      expect(config.name).toBe("test-config");
      expect(config.description).toBe("A test config");
      expect(config.endpoint).toBe("https://mcp.example.com");
      expect(config.allowed_tools).toEqual([
        "github.search_*",
        "github.get_*",
      ]);
    });

    it("maps null description to undefined", async () => {
      mockRetrieve.mockResolvedValue({
        ...baseMcpConfigView,
        description: null,
      });

      const { getMcpConfig } = await import("@/services/mcpConfigService.js");
      const config = await getMcpConfig("mcp_abc123");

      expect(config.description).toBeUndefined();
    });

    it("handles non-array allowed_tools", async () => {
      mockRetrieve.mockResolvedValue({
        ...baseMcpConfigView,
        allowed_tools: undefined,
      });

      const { getMcpConfig } = await import("@/services/mcpConfigService.js");
      const config = await getMcpConfig("mcp_abc123");

      expect(config.allowed_tools).toEqual([]);
    });
  });

  describe("getMcpConfigByIdOrName", () => {
    it("returns config when found by ID", async () => {
      mockRetrieve.mockResolvedValue(baseMcpConfigView);

      const { getMcpConfigByIdOrName } = await import(
        "@/services/mcpConfigService.js"
      );
      const config = await getMcpConfigByIdOrName("mcp_abc123");

      expect(config).not.toBeNull();
      expect(config!.id).toBe("mcp_abc123");
      expect(mockList).not.toHaveBeenCalled();
    });

    it("falls back to name search on ID lookup failure", async () => {
      mockRetrieve
        .mockRejectedValueOnce(new Error("404 not found"))
        .mockResolvedValueOnce(baseMcpConfigView);

      mockList.mockResolvedValue({
        mcp_configs: [baseMcpConfigView],
        has_more: false,
      });

      const { getMcpConfigByIdOrName } = await import(
        "@/services/mcpConfigService.js"
      );
      const config = await getMcpConfigByIdOrName("test-config");

      expect(config).not.toBeNull();
      expect(mockList).toHaveBeenCalledWith({
        limit: 100,
        name: "test-config",
      });
    });

    it("returns null when no match found", async () => {
      mockRetrieve.mockRejectedValue(new Error("404 not found"));
      mockList.mockResolvedValue({
        mcp_configs: [],
        has_more: false,
      });

      const { getMcpConfigByIdOrName } = await import(
        "@/services/mcpConfigService.js"
      );
      const config = await getMcpConfigByIdOrName("nonexistent");

      expect(config).toBeNull();
    });

    it("prefers exact name match over first result", async () => {
      const exactMatch = { ...baseMcpConfigView, id: "mcp_exact", name: "my-config" };
      const partialMatch = { ...baseMcpConfigView, id: "mcp_partial", name: "my-config-v2" };

      mockRetrieve
        .mockRejectedValueOnce(new Error("404"))
        .mockResolvedValueOnce(exactMatch);

      mockList.mockResolvedValue({
        mcp_configs: [partialMatch, exactMatch],
        has_more: false,
      });

      const { getMcpConfigByIdOrName } = await import(
        "@/services/mcpConfigService.js"
      );
      const config = await getMcpConfigByIdOrName("my-config");

      expect(config).not.toBeNull();
      // The second retrieve call should be for the exact match
      expect(mockRetrieve).toHaveBeenLastCalledWith("mcp_exact");
    });
  });

  describe("createMcpConfig", () => {
    it("passes params to API and maps response", async () => {
      mockCreate.mockResolvedValue(baseMcpConfigView);

      const { createMcpConfig } = await import(
        "@/services/mcpConfigService.js"
      );
      const config = await createMcpConfig({
        name: "test-config",
        endpoint: "https://mcp.example.com",
        allowed_tools: ["*"],
        description: "test",
      });

      expect(mockCreate).toHaveBeenCalledWith({
        name: "test-config",
        endpoint: "https://mcp.example.com",
        allowed_tools: ["*"],
        description: "test",
      });
      expect(config.id).toBe("mcp_abc123");
    });
  });

  describe("updateMcpConfig", () => {
    it("passes ID and params to API and maps response", async () => {
      mockUpdate.mockResolvedValue({
        ...baseMcpConfigView,
        name: "updated-name",
      });

      const { updateMcpConfig } = await import(
        "@/services/mcpConfigService.js"
      );
      const config = await updateMcpConfig("mcp_abc123", {
        name: "updated-name",
      });

      expect(mockUpdate).toHaveBeenCalledWith("mcp_abc123", {
        name: "updated-name",
      });
      expect(config.name).toBe("updated-name");
    });
  });

  describe("deleteMcpConfig", () => {
    it("calls delete with correct ID", async () => {
      mockDelete.mockResolvedValue(undefined);

      const { deleteMcpConfig } = await import(
        "@/services/mcpConfigService.js"
      );
      await deleteMcpConfig("mcp_abc123");

      expect(mockDelete).toHaveBeenCalledWith("mcp_abc123");
    });
  });
});

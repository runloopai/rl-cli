/**
 * Tests for MCP config Zustand store
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { useMcpConfigStore } from "../../../src/store/mcpConfigStore.js";

const makeMockConfig = (id: string) => ({
  id,
  name: `config-${id}`,
  description: `desc-${id}`,
  endpoint: `https://${id}.example.com`,
  create_time_ms: 1700000000000,
  allowed_tools: ["*"],
});

describe("useMcpConfigStore", () => {
  beforeEach(() => {
    useMcpConfigStore.getState().clearAll();
  });

  describe("initial state", () => {
    it("has empty configs list", () => {
      const state = useMcpConfigStore.getState();
      expect(state.mcpConfigs).toEqual([]);
    });

    it("has loading false and initialLoading true", () => {
      const state = useMcpConfigStore.getState();
      expect(state.loading).toBe(false);
      expect(state.initialLoading).toBe(true);
    });

    it("has no error", () => {
      expect(useMcpConfigStore.getState().error).toBeNull();
    });

    it("has page 0 and pageSize 10", () => {
      const state = useMcpConfigStore.getState();
      expect(state.currentPage).toBe(0);
      expect(state.pageSize).toBe(10);
    });

    it("has empty search query", () => {
      expect(useMcpConfigStore.getState().searchQuery).toBe("");
    });

    it("has selectedIndex 0", () => {
      expect(useMcpConfigStore.getState().selectedIndex).toBe(0);
    });
  });

  describe("setters", () => {
    it("setMcpConfigs updates the list", () => {
      const configs = [makeMockConfig("mcp_1"), makeMockConfig("mcp_2")];
      useMcpConfigStore.getState().setMcpConfigs(configs);
      expect(useMcpConfigStore.getState().mcpConfigs).toHaveLength(2);
    });

    it("setLoading updates loading state", () => {
      useMcpConfigStore.getState().setLoading(true);
      expect(useMcpConfigStore.getState().loading).toBe(true);
    });

    it("setError updates error state", () => {
      const error = new Error("test error");
      useMcpConfigStore.getState().setError(error);
      expect(useMcpConfigStore.getState().error).toBe(error);
    });

    it("setError clears error with null", () => {
      useMcpConfigStore.getState().setError(new Error("err"));
      useMcpConfigStore.getState().setError(null);
      expect(useMcpConfigStore.getState().error).toBeNull();
    });

    it("setCurrentPage updates page", () => {
      useMcpConfigStore.getState().setCurrentPage(5);
      expect(useMcpConfigStore.getState().currentPage).toBe(5);
    });

    it("setSearchQuery updates query", () => {
      useMcpConfigStore.getState().setSearchQuery("test-search");
      expect(useMcpConfigStore.getState().searchQuery).toBe("test-search");
    });

    it("setSelectedIndex updates index", () => {
      useMcpConfigStore.getState().setSelectedIndex(3);
      expect(useMcpConfigStore.getState().selectedIndex).toBe(3);
    });

    it("setHasMore updates hasMore", () => {
      useMcpConfigStore.getState().setHasMore(true);
      expect(useMcpConfigStore.getState().hasMore).toBe(true);
    });

    it("setTotalCount updates totalCount", () => {
      useMcpConfigStore.getState().setTotalCount(42);
      expect(useMcpConfigStore.getState().totalCount).toBe(42);
    });
  });

  describe("cachePageData and getCachedPage", () => {
    it("stores and retrieves page data", () => {
      const configs = [makeMockConfig("mcp_1")];
      useMcpConfigStore.getState().cachePageData(0, configs, "mcp_1");

      const cached = useMcpConfigStore.getState().getCachedPage(0);
      expect(cached).toHaveLength(1);
      expect(cached![0].id).toBe("mcp_1");
    });

    it("returns undefined for uncached pages", () => {
      const cached = useMcpConfigStore.getState().getCachedPage(99);
      expect(cached).toBeUndefined();
    });

    it("serializes data via JSON roundtrip (strips non-serializable properties)", () => {
      const configs = [makeMockConfig("mcp_1")];
      useMcpConfigStore.getState().cachePageData(0, configs, "mcp_1");

      const cached = useMcpConfigStore.getState().getCachedPage(0);
      expect(cached).toEqual(configs);
    });
  });

  describe("LRU eviction", () => {
    it("evicts oldest entry when cache exceeds MAX_CACHE_SIZE (10)", () => {
      const store = useMcpConfigStore.getState();

      for (let i = 0; i < 11; i++) {
        store.cachePageData(i, [makeMockConfig(`mcp_${i}`)], `mcp_${i}`);
      }

      // Page 0 should have been evicted
      expect(store.getCachedPage(0)).toBeUndefined();
      // Page 1 through 10 should still be cached
      expect(store.getCachedPage(1)).toBeDefined();
      expect(store.getCachedPage(10)).toBeDefined();
    });
  });

  describe("clearCache", () => {
    it("clears all cached pages", () => {
      const store = useMcpConfigStore.getState();
      store.cachePageData(0, [makeMockConfig("mcp_1")], "mcp_1");
      store.cachePageData(1, [makeMockConfig("mcp_2")], "mcp_2");

      store.clearCache();

      expect(store.getCachedPage(0)).toBeUndefined();
      expect(store.getCachedPage(1)).toBeUndefined();
    });
  });

  describe("clearAll", () => {
    it("resets entire store to initial state", () => {
      const store = useMcpConfigStore.getState();

      store.setMcpConfigs([makeMockConfig("mcp_1")]);
      store.setLoading(true);
      store.setError(new Error("test"));
      store.setCurrentPage(5);
      store.setSearchQuery("query");
      store.setSelectedIndex(3);
      store.setHasMore(true);
      store.cachePageData(0, [makeMockConfig("mcp_1")], "mcp_1");

      store.clearAll();

      const state = useMcpConfigStore.getState();
      expect(state.mcpConfigs).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.initialLoading).toBe(true);
      expect(state.error).toBeNull();
      expect(state.currentPage).toBe(0);
      expect(state.searchQuery).toBe("");
      expect(state.selectedIndex).toBe(0);
      expect(state.hasMore).toBe(false);
      expect(state.getCachedPage(0)).toBeUndefined();
    });
  });

  describe("getSelectedMcpConfig", () => {
    it("returns config at selectedIndex", () => {
      const configs = [makeMockConfig("mcp_1"), makeMockConfig("mcp_2")];
      const store = useMcpConfigStore.getState();
      store.setMcpConfigs(configs);
      store.setSelectedIndex(1);

      expect(store.getSelectedMcpConfig()?.id).toBe("mcp_2");
    });

    it("returns undefined for out-of-range index", () => {
      const store = useMcpConfigStore.getState();
      store.setMcpConfigs([makeMockConfig("mcp_1")]);
      store.setSelectedIndex(5);

      expect(store.getSelectedMcpConfig()).toBeUndefined();
    });

    it("returns undefined when list is empty", () => {
      expect(
        useMcpConfigStore.getState().getSelectedMcpConfig(),
      ).toBeUndefined();
    });
  });
});

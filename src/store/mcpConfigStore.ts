/**
 * MCP Config Store - Manages MCP configuration state, pagination, and caching
 */
import { create } from "zustand";
import type { McpConfigView } from "@runloop/api-client/resources/mcp-configs";

export type McpConfig = McpConfigView;

interface McpConfigState {
  // List data
  mcpConfigs: McpConfig[];
  loading: boolean;
  initialLoading: boolean;
  error: Error | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;

  // Caching
  pageCache: Map<number, McpConfig[]>;
  lastIdCache: Map<number, string>;

  // Search/filter
  searchQuery: string;

  // Selection
  selectedIndex: number;

  // Actions
  setMcpConfigs: (configs: McpConfig[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  setHasMore: (hasMore: boolean) => void;

  setSearchQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;

  cachePageData: (page: number, data: McpConfig[], lastId: string) => void;
  getCachedPage: (page: number) => McpConfig[] | undefined;
  clearCache: () => void;
  clearAll: () => void;

  getSelectedMcpConfig: () => McpConfig | undefined;
}

const MAX_CACHE_SIZE = 10;

export const useMcpConfigStore = create<McpConfigState>((set, get) => ({
  mcpConfigs: [],
  loading: false,
  initialLoading: true,
  error: null,

  currentPage: 0,
  pageSize: 10,
  totalCount: 0,
  hasMore: false,

  pageCache: new Map(),
  lastIdCache: new Map(),

  searchQuery: "",
  selectedIndex: 0,

  setMcpConfigs: (configs) => set({ mcpConfigs: configs }),
  setLoading: (loading) => set({ loading }),
  setInitialLoading: (loading) => set({ initialLoading: loading }),
  setError: (error) => set({ error }),

  setCurrentPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size }),
  setTotalCount: (count) => set({ totalCount: count }),
  setHasMore: (hasMore) => set({ hasMore }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),

  cachePageData: (page, data, lastId) => {
    const state = get();
    const pageCache = state.pageCache;
    const lastIdCache = state.lastIdCache;

    if (pageCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = pageCache.keys().next().value;
      if (oldestKey !== undefined) {
        pageCache.delete(oldestKey);
        lastIdCache.delete(oldestKey);
      }
    }

    const plainData = data.map((d) => {
      return JSON.parse(JSON.stringify(d)) as McpConfig;
    });

    pageCache.set(page, plainData);
    lastIdCache.set(page, lastId);

    set({});
  },

  getCachedPage: (page) => {
    return get().pageCache.get(page);
  },

  clearCache: () => {
    const state = get();
    state.pageCache.clear();
    state.lastIdCache.clear();

    set({
      pageCache: new Map(),
      lastIdCache: new Map(),
    });
  },

  clearAll: () => {
    const state = get();
    state.pageCache.clear();
    state.lastIdCache.clear();

    set({
      mcpConfigs: [],
      loading: false,
      initialLoading: true,
      error: null,
      currentPage: 0,
      totalCount: 0,
      hasMore: false,
      pageCache: new Map(),
      lastIdCache: new Map(),
      searchQuery: "",
      selectedIndex: 0,
    });
  },

  getSelectedMcpConfig: () => {
    const state = get();
    return state.mcpConfigs[state.selectedIndex];
  },
}));

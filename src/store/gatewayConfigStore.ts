/**
 * Gateway Config Store - Manages gateway configuration state, pagination, and caching
 */
import { create } from "zustand";
import type { GatewayConfigView } from "@runloop/api-client/resources/gateway-configs";

// Re-export for compatibility with existing code
export type GatewayConfig = GatewayConfigView;
export type GatewayConfigAuthMechanism = GatewayConfigView.AuthMechanism;

interface GatewayConfigState {
  // List data
  gatewayConfigs: GatewayConfig[];
  loading: boolean;
  initialLoading: boolean;
  error: Error | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;

  // Caching
  pageCache: Map<number, GatewayConfig[]>;
  lastIdCache: Map<number, string>;

  // Search/filter
  searchQuery: string;

  // Selection
  selectedIndex: number;

  // Actions
  setGatewayConfigs: (configs: GatewayConfig[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  setHasMore: (hasMore: boolean) => void;

  setSearchQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;

  cachePageData: (page: number, data: GatewayConfig[], lastId: string) => void;
  getCachedPage: (page: number) => GatewayConfig[] | undefined;
  clearCache: () => void;
  clearAll: () => void;

  getSelectedGatewayConfig: () => GatewayConfig | undefined;
}

const MAX_CACHE_SIZE = 10;

export const useGatewayConfigStore = create<GatewayConfigState>((set, get) => ({
  gatewayConfigs: [],
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

  setGatewayConfigs: (configs) => set({ gatewayConfigs: configs }),
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

    // Aggressive LRU eviction
    if (pageCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = pageCache.keys().next().value;
      if (oldestKey !== undefined) {
        pageCache.delete(oldestKey);
        lastIdCache.delete(oldestKey);
      }
    }

    // Deep copy all fields to avoid SDK references
    const plainData = data.map((d) => {
      return JSON.parse(JSON.stringify(d)) as GatewayConfig;
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
      gatewayConfigs: [],
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

  getSelectedGatewayConfig: () => {
    const state = get();
    return state.gatewayConfigs[state.selectedIndex];
  },
}));

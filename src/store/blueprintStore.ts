/**
 * Blueprint Store - Manages blueprint list state, pagination, and caching
 */
import { create } from "zustand";

export interface Blueprint {
  id: string;
  name?: string;
  status: string;
  create_time_ms?: number;
  build_status?: string;
  architecture?: string;
  resources?: string;
}

interface BlueprintState {
  // List data
  blueprints: Blueprint[];
  loading: boolean;
  initialLoading: boolean;
  error: Error | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;

  // Caching
  pageCache: Map<number, Blueprint[]>;
  lastIdCache: Map<number, string>;

  // Search/filter
  searchQuery: string;

  // Selection
  selectedIndex: number;

  // Actions
  setBlueprints: (blueprints: Blueprint[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  setHasMore: (hasMore: boolean) => void;

  setSearchQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;

  cachePageData: (page: number, data: Blueprint[], lastId: string) => void;
  getCachedPage: (page: number) => Blueprint[] | undefined;
  clearCache: () => void;
  clearAll: () => void;

  getSelectedBlueprint: () => Blueprint | undefined;
}

const MAX_CACHE_SIZE = 10;

export const useBlueprintStore = create<BlueprintState>((set, get) => ({
  blueprints: [],
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

  setBlueprints: (blueprints) => set({ blueprints }),
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

    // Create plain data objects to avoid SDK references
    const plainData = data.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      create_time_ms: b.create_time_ms,
      build_status: b.build_status,
      architecture: b.architecture,
      resources: b.resources,
    }));

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
      blueprints: [],
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

  getSelectedBlueprint: () => {
    const state = get();
    return state.blueprints[state.selectedIndex];
  },
}));

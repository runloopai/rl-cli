/**
 * Devbox Store - Manages devbox list state, pagination, and caching
 * Replaces useState/useRef from ListDevboxesUI
 */
import { create } from "zustand";

export interface Devbox {
  id: string;
  name?: string;
  status: string;
  create_time_ms?: number;
  blueprint_id?: string;
  entitlements?: {
    network_enabled?: boolean;
    gpu_enabled?: boolean;
  };
  launch_parameters?: any; // Can contain nested objects with user_parameters
  [key: string]: any; // Allow other fields from API
}

interface DevboxState {
  // List data
  devboxes: Devbox[];
  loading: boolean;
  initialLoading: boolean;
  error: Error | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;

  // Caching (LRU with max size)
  pageCache: Map<number, Devbox[]>;
  lastIdCache: Map<number, string>;

  // Search/filter
  searchQuery: string;
  statusFilter?: string;

  // Selection
  selectedIndex: number;

  // Actions
  setDevboxes: (devboxes: Devbox[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  setHasMore: (hasMore: boolean) => void;

  setSearchQuery: (query: string) => void;
  setStatusFilter: (status?: string) => void;

  setSelectedIndex: (index: number) => void;

  // Cache management
  cachePageData: (page: number, data: Devbox[], lastId: string) => void;
  getCachedPage: (page: number) => Devbox[] | undefined;
  clearCache: () => void;

  // Memory cleanup
  clearAll: () => void;

  // Getters
  getSelectedDevbox: () => Devbox | undefined;
}

const MAX_CACHE_SIZE = 10; // Limit cache to 10 pages

export const useDevboxStore = create<DevboxState>((set, get) => ({
  // Initial state
  devboxes: [],
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
  statusFilter: undefined,

  selectedIndex: 0,

  // Actions
  setDevboxes: (devboxes) => set({ devboxes }),
  setLoading: (loading) => set({ loading }),
  setInitialLoading: (loading) => set({ initialLoading: loading }),
  setError: (error) => set({ error }),

  setCurrentPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size }),
  setTotalCount: (count) => set({ totalCount: count }),
  setHasMore: (hasMore) => set({ hasMore }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),

  setSelectedIndex: (index) => set({ selectedIndex: index }),

  // Cache management with LRU eviction
  cachePageData: (page, data, lastId) => {
    set((state) => {
      const newPageCache = new Map(state.pageCache);
      const newLastIdCache = new Map(state.lastIdCache);

      // LRU eviction: if cache is full, remove oldest entry
      if (newPageCache.size >= MAX_CACHE_SIZE) {
        const firstKey = newPageCache.keys().next().value;
        if (firstKey !== undefined) {
          newPageCache.delete(firstKey);
          newLastIdCache.delete(firstKey);
        }
      }

      newPageCache.set(page, data);
      newLastIdCache.set(page, lastId);

      return {
        pageCache: newPageCache,
        lastIdCache: newLastIdCache,
      };
    });
  },

  getCachedPage: (page) => {
    return get().pageCache.get(page);
  },

  clearCache: () => {
    set({
      pageCache: new Map(),
      lastIdCache: new Map(),
    });
  },

  // Aggressive memory cleanup
  clearAll: () => {
    set({
      devboxes: [],
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

  // Getters
  getSelectedDevbox: () => {
    const state = get();
    return state.devboxes[state.selectedIndex];
  },
}));

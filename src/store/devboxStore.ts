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
  setDevboxes: (devboxes) => {
    const state = get();
    const maxIndex = devboxes.length > 0 ? devboxes.length - 1 : 0;
    const clampedIndex = Math.max(0, Math.min(state.selectedIndex, maxIndex));
    set({ devboxes, selectedIndex: clampedIndex });
  },
  setLoading: (loading) => set({ loading }),
  setInitialLoading: (loading) => set({ initialLoading: loading }),
  setError: (error) => set({ error }),

  setCurrentPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size }),
  setTotalCount: (count) => set({ totalCount: count }),
  setHasMore: (hasMore) => set({ hasMore }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),

  setSelectedIndex: (index) => {
    const state = get();
    const maxIndex = state.devboxes.length > 0 ? state.devboxes.length - 1 : 0;
    const clampedIndex = Math.max(0, Math.min(index, maxIndex));
    set({ selectedIndex: clampedIndex });
  },

  // Cache management with LRU eviction - FIXED: No shallow copies
  cachePageData: (page, data, lastId) => {
    const state = get();
    const pageCache = state.pageCache;
    const lastIdCache = state.lastIdCache;

    // Aggressive LRU eviction: Remove oldest entries if at limit
    if (pageCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = pageCache.keys().next().value;
      if (oldestKey !== undefined) {
        pageCache.delete(oldestKey);
        lastIdCache.delete(oldestKey);
      }
    }

    // Direct mutation - create plain data objects to avoid SDK references
    const plainData = data.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      create_time_ms: d.create_time_ms,
      blueprint_id: d.blueprint_id,
      entitlements: d.entitlements ? { ...d.entitlements } : undefined,
    }));

    pageCache.set(page, plainData);
    lastIdCache.set(page, lastId);

    // Trigger update without creating new Map
    set({});
  },

  getCachedPage: (page) => {
    return get().pageCache.get(page);
  },

  clearCache: () => {
    const state = get();
    // Explicitly clear all entries before reassigning
    state.pageCache.clear();
    state.lastIdCache.clear();

    set({
      pageCache: new Map(),
      lastIdCache: new Map(),
    });
  },

  // Aggressive memory cleanup
  clearAll: () => {
    const state = get();
    // Clear existing structures first to release references
    state.pageCache.clear();
    state.lastIdCache.clear();

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

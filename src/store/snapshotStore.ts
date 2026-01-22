/**
 * Snapshot Store - Manages snapshot list state, pagination, and caching
 */
import { create } from "zustand";

export interface Snapshot {
  id: string;
  name?: string;
  devbox_id?: string;
  status: string;
  create_time_ms?: number;
  // Extended fields for detail view
  metadata?: Record<string, string>;
  disk_size_bytes?: number;
}

interface SnapshotState {
  // List data
  snapshots: Snapshot[];
  loading: boolean;
  initialLoading: boolean;
  error: Error | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;

  // Caching
  pageCache: Map<number, Snapshot[]>;
  lastIdCache: Map<number, string>;

  // Filter
  devboxIdFilter?: string;

  // Selection
  selectedIndex: number;

  // Actions
  setSnapshots: (snapshots: Snapshot[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  setHasMore: (hasMore: boolean) => void;

  setDevboxIdFilter: (devboxId?: string) => void;
  setSelectedIndex: (index: number) => void;

  cachePageData: (page: number, data: Snapshot[], lastId: string) => void;
  getCachedPage: (page: number) => Snapshot[] | undefined;
  clearCache: () => void;
  clearAll: () => void;

  getSelectedSnapshot: () => Snapshot | undefined;
}

const MAX_CACHE_SIZE = 10;

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  snapshots: [],
  loading: false,
  initialLoading: true,
  error: null,

  currentPage: 0,
  pageSize: 10,
  totalCount: 0,
  hasMore: false,

  pageCache: new Map(),
  lastIdCache: new Map(),

  devboxIdFilter: undefined,
  selectedIndex: 0,

  setSnapshots: (snapshots) => set({ snapshots }),
  setLoading: (loading) => set({ loading }),
  setInitialLoading: (loading) => set({ initialLoading: loading }),
  setError: (error) => set({ error }),

  setCurrentPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size }),
  setTotalCount: (count) => set({ totalCount: count }),
  setHasMore: (hasMore) => set({ hasMore }),

  setDevboxIdFilter: (devboxId) => set({ devboxIdFilter: devboxId }),
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
    const plainData = data.map((s) => ({
      id: s.id,
      name: s.name,
      devbox_id: s.devbox_id,
      status: s.status,
      create_time_ms: s.create_time_ms,
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
      snapshots: [],
      loading: false,
      initialLoading: true,
      error: null,
      currentPage: 0,
      totalCount: 0,
      hasMore: false,
      pageCache: new Map(),
      lastIdCache: new Map(),
      devboxIdFilter: undefined,
      selectedIndex: 0,
    });
  },

  getSelectedSnapshot: () => {
    const state = get();
    return state.snapshots[state.selectedIndex];
  },
}));

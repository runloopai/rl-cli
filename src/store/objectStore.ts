/**
 * Object Store - Manages storage object list state, pagination, and caching
 */
import { create } from "zustand";

export interface StorageObject {
  id: string;
  name?: string;
  content_type?: string;
  size_bytes?: number;
  state?: string;
  is_public?: boolean;
  create_time_ms?: number;
  // Extended fields for detail view
  download_url?: string;
  metadata?: Record<string, string>;
}

interface ObjectState {
  // List data
  objects: StorageObject[];
  loading: boolean;
  initialLoading: boolean;
  error: Error | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;

  // Caching
  pageCache: Map<number, StorageObject[]>;
  lastIdCache: Map<number, string>;

  // Filters
  nameFilter?: string;
  contentTypeFilter?: string;
  stateFilter?: string;
  isPublicFilter?: boolean;

  // Selection
  selectedIndex: number;

  // Actions
  setObjects: (objects: StorageObject[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  setHasMore: (hasMore: boolean) => void;

  setNameFilter: (name?: string) => void;
  setContentTypeFilter: (contentType?: string) => void;
  setStateFilter: (state?: string) => void;
  setIsPublicFilter: (isPublic?: boolean) => void;
  setSelectedIndex: (index: number) => void;

  cachePageData: (page: number, data: StorageObject[], lastId: string) => void;
  getCachedPage: (page: number) => StorageObject[] | undefined;
  clearCache: () => void;
  clearAll: () => void;

  getSelectedObject: () => StorageObject | undefined;
}

const MAX_CACHE_SIZE = 10;

export const useObjectStore = create<ObjectState>((set, get) => ({
  objects: [],
  loading: false,
  initialLoading: true,
  error: null,

  currentPage: 0,
  pageSize: 10,
  totalCount: 0,
  hasMore: false,

  pageCache: new Map(),
  lastIdCache: new Map(),

  nameFilter: undefined,
  contentTypeFilter: undefined,
  stateFilter: undefined,
  isPublicFilter: undefined,
  selectedIndex: 0,

  setObjects: (objects) => set({ objects }),
  setLoading: (loading) => set({ loading }),
  setInitialLoading: (loading) => set({ initialLoading: loading }),
  setError: (error) => set({ error }),

  setCurrentPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size }),
  setTotalCount: (count) => set({ totalCount: count }),
  setHasMore: (hasMore) => set({ hasMore }),

  setNameFilter: (name) => set({ nameFilter: name }),
  setContentTypeFilter: (contentType) =>
    set({ contentTypeFilter: contentType }),
  setStateFilter: (state) => set({ stateFilter: state }),
  setIsPublicFilter: (isPublic) => set({ isPublicFilter: isPublic }),
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
    const plainData = data.map((obj) => ({
      id: obj.id,
      name: obj.name,
      content_type: obj.content_type,
      size_bytes: obj.size_bytes,
      state: obj.state,
      is_public: obj.is_public,
      create_time_ms: obj.create_time_ms,
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
      objects: [],
      loading: false,
      initialLoading: true,
      error: null,
      currentPage: 0,
      totalCount: 0,
      hasMore: false,
      pageCache: new Map(),
      lastIdCache: new Map(),
      nameFilter: undefined,
      contentTypeFilter: undefined,
      stateFilter: undefined,
      isPublicFilter: undefined,
      selectedIndex: 0,
    });
  },

  getSelectedObject: () => {
    const state = get();
    return state.objects[state.selectedIndex];
  },
}));

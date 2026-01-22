/**
 * Network Policy Store - Manages network policy list state, pagination, and caching
 */
import { create } from "zustand";
import type { NetworkPolicyView } from "@runloop/api-client/resources/network-policies";

// Re-export for compatibility with existing code
export type NetworkPolicy = NetworkPolicyView;
export type NetworkPolicyEgress = NetworkPolicyView.Egress;

interface NetworkPolicyState {
  // List data
  networkPolicies: NetworkPolicy[];
  loading: boolean;
  initialLoading: boolean;
  error: Error | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;

  // Caching
  pageCache: Map<number, NetworkPolicy[]>;
  lastIdCache: Map<number, string>;

  // Search/filter
  searchQuery: string;

  // Selection
  selectedIndex: number;

  // Actions
  setNetworkPolicies: (policies: NetworkPolicy[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  setHasMore: (hasMore: boolean) => void;

  setSearchQuery: (query: string) => void;
  setSelectedIndex: (index: number) => void;

  cachePageData: (page: number, data: NetworkPolicy[], lastId: string) => void;
  getCachedPage: (page: number) => NetworkPolicy[] | undefined;
  clearCache: () => void;
  clearAll: () => void;

  getSelectedNetworkPolicy: () => NetworkPolicy | undefined;
}

const MAX_CACHE_SIZE = 10;

export const useNetworkPolicyStore = create<NetworkPolicyState>((set, get) => ({
  networkPolicies: [],
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

  setNetworkPolicies: (policies) => set({ networkPolicies: policies }),
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
      return JSON.parse(JSON.stringify(d)) as NetworkPolicy;
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
      networkPolicies: [],
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

  getSelectedNetworkPolicy: () => {
    const state = get();
    return state.networkPolicies[state.selectedIndex];
  },
}));

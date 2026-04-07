/**
 * Agent Store - Manages agent list state, pagination, and caching
 */
import { create } from "zustand";
import type { AgentView } from "@runloop/api-client/resources/agents";

export type Agent = AgentView;

interface AgentState {
  // List data
  agents: Agent[];
  loading: boolean;
  initialLoading: boolean;
  error: Error | null;

  // Pagination
  currentPage: number;
  pageSize: number;
  totalCount: number;
  hasMore: boolean;

  // Caching
  pageCache: Map<number, Agent[]>;
  lastIdCache: Map<number, string>;

  // Filters
  nameFilter?: string;
  searchFilter?: string;
  visibilityFilter?: "public" | "private";

  // Selection
  selectedIndex: number;

  // Actions
  setAgents: (agents: Agent[]) => void;
  setLoading: (loading: boolean) => void;
  setInitialLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotalCount: (count: number) => void;
  setHasMore: (hasMore: boolean) => void;

  setNameFilter: (name?: string) => void;
  setSearchFilter: (search?: string) => void;
  setVisibilityFilter: (visibility?: "public" | "private") => void;
  setSelectedIndex: (index: number) => void;

  cachePageData: (page: number, data: Agent[], lastId: string) => void;
  getCachedPage: (page: number) => Agent[] | undefined;
  clearCache: () => void;
  clearAll: () => void;

  getSelectedAgent: () => Agent | undefined;
}

const MAX_CACHE_SIZE = 10;

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
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
  searchFilter: undefined,
  visibilityFilter: undefined,
  selectedIndex: 0,

  setAgents: (agents) => set({ agents }),
  setLoading: (loading) => set({ loading }),
  setInitialLoading: (loading) => set({ initialLoading: loading }),
  setError: (error) => set({ error }),

  setCurrentPage: (page) => set({ currentPage: page }),
  setPageSize: (size) => set({ pageSize: size }),
  setTotalCount: (count) => set({ totalCount: count }),
  setHasMore: (hasMore) => set({ hasMore }),

  setNameFilter: (name) => set({ nameFilter: name }),
  setSearchFilter: (search) => set({ searchFilter: search }),
  setVisibilityFilter: (visibility) => set({ visibilityFilter: visibility }),
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

    const plainData = data.map((d) => JSON.parse(JSON.stringify(d)) as Agent);
    pageCache.set(page, plainData);
    lastIdCache.set(page, lastId);
    set({});
  },

  getCachedPage: (page) => get().pageCache.get(page),

  clearCache: () => {
    const state = get();
    state.pageCache.clear();
    state.lastIdCache.clear();
    set({ pageCache: new Map(), lastIdCache: new Map() });
  },

  clearAll: () => {
    const state = get();
    state.pageCache.clear();
    state.lastIdCache.clear();
    set({
      agents: [],
      loading: false,
      initialLoading: true,
      error: null,
      currentPage: 0,
      totalCount: 0,
      hasMore: false,
      pageCache: new Map(),
      lastIdCache: new Map(),
      nameFilter: undefined,
      searchFilter: undefined,
      visibilityFilter: undefined,
      selectedIndex: 0,
    });
  },

  getSelectedAgent: () => {
    const state = get();
    return state.agents[state.selectedIndex];
  },
}));

/**
 * Benchmark Store - Manages benchmark run and scenario run state
 */
import { create } from "zustand";
import type { BenchmarkRunView } from "@runloop/api-client/resources/benchmark-runs";
import type { ScenarioRunView } from "@runloop/api-client/resources/scenarios/scenarios";

// Re-export SDK types for compatibility
export type BenchmarkRun = BenchmarkRunView;
export type ScenarioRun = ScenarioRunView;

interface BenchmarkState {
  // Benchmark runs
  benchmarkRuns: BenchmarkRun[];
  benchmarkRunsLoading: boolean;
  benchmarkRunsError: Error | null;
  benchmarkRunsTotalCount: number;
  benchmarkRunsHasMore: boolean;
  benchmarkRunsCurrentPage: number;

  // Scenario runs
  scenarioRuns: ScenarioRun[];
  scenarioRunsLoading: boolean;
  scenarioRunsError: Error | null;
  scenarioRunsTotalCount: number;
  scenarioRunsHasMore: boolean;
  scenarioRunsCurrentPage: number;

  // Filter
  benchmarkRunIdFilter?: string;

  // Selection
  selectedBenchmarkRunIndex: number;
  selectedScenarioRunIndex: number;

  // Caching
  benchmarkRunPageCache: Map<number, BenchmarkRun[]>;
  scenarioRunPageCache: Map<number, ScenarioRun[]>;

  // Benchmark Run Actions
  setBenchmarkRuns: (runs: BenchmarkRun[]) => void;
  setBenchmarkRunsLoading: (loading: boolean) => void;
  setBenchmarkRunsError: (error: Error | null) => void;
  setBenchmarkRunsTotalCount: (count: number) => void;
  setBenchmarkRunsHasMore: (hasMore: boolean) => void;
  setBenchmarkRunsCurrentPage: (page: number) => void;
  setSelectedBenchmarkRunIndex: (index: number) => void;

  // Scenario Run Actions
  setScenarioRuns: (runs: ScenarioRun[]) => void;
  setScenarioRunsLoading: (loading: boolean) => void;
  setScenarioRunsError: (error: Error | null) => void;
  setScenarioRunsTotalCount: (count: number) => void;
  setScenarioRunsHasMore: (hasMore: boolean) => void;
  setScenarioRunsCurrentPage: (page: number) => void;
  setSelectedScenarioRunIndex: (index: number) => void;
  setBenchmarkRunIdFilter: (id?: string) => void;

  // Cache management
  cacheBenchmarkRunPage: (page: number, data: BenchmarkRun[]) => void;
  getCachedBenchmarkRunPage: (page: number) => BenchmarkRun[] | undefined;
  cacheScenarioRunPage: (page: number, data: ScenarioRun[]) => void;
  getCachedScenarioRunPage: (page: number) => ScenarioRun[] | undefined;
  clearCache: () => void;
  clearAll: () => void;

  // Selectors
  getSelectedBenchmarkRun: () => BenchmarkRun | undefined;
  getSelectedScenarioRun: () => ScenarioRun | undefined;
}

const MAX_CACHE_SIZE = 10;

export const useBenchmarkStore = create<BenchmarkState>((set, get) => ({
  // Initial benchmark run state
  benchmarkRuns: [],
  benchmarkRunsLoading: false,
  benchmarkRunsError: null,
  benchmarkRunsTotalCount: 0,
  benchmarkRunsHasMore: false,
  benchmarkRunsCurrentPage: 0,

  // Initial scenario run state
  scenarioRuns: [],
  scenarioRunsLoading: false,
  scenarioRunsError: null,
  scenarioRunsTotalCount: 0,
  scenarioRunsHasMore: false,
  scenarioRunsCurrentPage: 0,

  // Filters
  benchmarkRunIdFilter: undefined,

  // Selection
  selectedBenchmarkRunIndex: 0,
  selectedScenarioRunIndex: 0,

  // Caches
  benchmarkRunPageCache: new Map(),
  scenarioRunPageCache: new Map(),

  // Benchmark Run Actions
  setBenchmarkRuns: (runs) => set({ benchmarkRuns: runs }),
  setBenchmarkRunsLoading: (loading) => set({ benchmarkRunsLoading: loading }),
  setBenchmarkRunsError: (error) => set({ benchmarkRunsError: error }),
  setBenchmarkRunsTotalCount: (count) =>
    set({ benchmarkRunsTotalCount: count }),
  setBenchmarkRunsHasMore: (hasMore) => set({ benchmarkRunsHasMore: hasMore }),
  setBenchmarkRunsCurrentPage: (page) =>
    set({ benchmarkRunsCurrentPage: page }),
  setSelectedBenchmarkRunIndex: (index) =>
    set({ selectedBenchmarkRunIndex: index }),

  // Scenario Run Actions
  setScenarioRuns: (runs) => set({ scenarioRuns: runs }),
  setScenarioRunsLoading: (loading) => set({ scenarioRunsLoading: loading }),
  setScenarioRunsError: (error) => set({ scenarioRunsError: error }),
  setScenarioRunsTotalCount: (count) => set({ scenarioRunsTotalCount: count }),
  setScenarioRunsHasMore: (hasMore) => set({ scenarioRunsHasMore: hasMore }),
  setScenarioRunsCurrentPage: (page) => set({ scenarioRunsCurrentPage: page }),
  setSelectedScenarioRunIndex: (index) =>
    set({ selectedScenarioRunIndex: index }),
  setBenchmarkRunIdFilter: (id) => set({ benchmarkRunIdFilter: id }),

  // Cache management
  cacheBenchmarkRunPage: (page, data) => {
    const state = get();
    const cache = state.benchmarkRunPageCache;

    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    const plainData = data.map(
      (d) => JSON.parse(JSON.stringify(d)) as BenchmarkRun,
    );
    cache.set(page, plainData);
    set({});
  },

  getCachedBenchmarkRunPage: (page) => {
    return get().benchmarkRunPageCache.get(page);
  },

  cacheScenarioRunPage: (page, data) => {
    const state = get();
    const cache = state.scenarioRunPageCache;

    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    const plainData = data.map(
      (d) => JSON.parse(JSON.stringify(d)) as ScenarioRun,
    );
    cache.set(page, plainData);
    set({});
  },

  getCachedScenarioRunPage: (page) => {
    return get().scenarioRunPageCache.get(page);
  },

  clearCache: () => {
    const state = get();
    state.benchmarkRunPageCache.clear();
    state.scenarioRunPageCache.clear();

    set({
      benchmarkRunPageCache: new Map(),
      scenarioRunPageCache: new Map(),
    });
  },

  clearAll: () => {
    const state = get();
    state.benchmarkRunPageCache.clear();
    state.scenarioRunPageCache.clear();

    set({
      benchmarkRuns: [],
      benchmarkRunsLoading: false,
      benchmarkRunsError: null,
      benchmarkRunsTotalCount: 0,
      benchmarkRunsHasMore: false,
      benchmarkRunsCurrentPage: 0,
      scenarioRuns: [],
      scenarioRunsLoading: false,
      scenarioRunsError: null,
      scenarioRunsTotalCount: 0,
      scenarioRunsHasMore: false,
      scenarioRunsCurrentPage: 0,
      benchmarkRunIdFilter: undefined,
      selectedBenchmarkRunIndex: 0,
      selectedScenarioRunIndex: 0,
      benchmarkRunPageCache: new Map(),
      scenarioRunPageCache: new Map(),
    });
  },

  getSelectedBenchmarkRun: () => {
    const state = get();
    return state.benchmarkRuns[state.selectedBenchmarkRunIndex];
  },

  getSelectedScenarioRun: () => {
    const state = get();
    return state.scenarioRuns[state.selectedScenarioRunIndex];
  },
}));

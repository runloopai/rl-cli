/**
 * Benchmark Store - Manages benchmark run and scenario run state
 */
import { create } from "zustand";
import type { BenchmarkRunView } from "@runloop/api-client/resources/benchmark-runs";
import type { ScenarioRunView } from "@runloop/api-client/resources/scenarios/scenarios";
import type { BenchmarkView } from "@runloop/api-client/resources/benchmarks";

// Re-export SDK types for compatibility
export type BenchmarkRun = BenchmarkRunView;
export type ScenarioRun = ScenarioRunView;
export type Benchmark = BenchmarkView;

interface BenchmarkState {
  // Benchmarks (definitions)
  benchmarks: Benchmark[];
  benchmarksLoading: boolean;
  benchmarksError: Error | null;
  benchmarksTotalCount: number;
  benchmarksHasMore: boolean;
  benchmarksCurrentPage: number;
  selectedBenchmarkIndex: number;
  selectedBenchmarkIds: Set<string>;

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
  benchmarkPageCache: Map<number, Benchmark[]>;
  benchmarkRunPageCache: Map<number, BenchmarkRun[]>;
  scenarioRunPageCache: Map<number, ScenarioRun[]>;

  // Benchmark (definition) Actions
  setBenchmarks: (benchmarks: Benchmark[]) => void;
  setBenchmarksLoading: (loading: boolean) => void;
  setBenchmarksError: (error: Error | null) => void;
  setBenchmarksTotalCount: (count: number) => void;
  setBenchmarksHasMore: (hasMore: boolean) => void;
  setBenchmarksCurrentPage: (page: number) => void;
  setSelectedBenchmarkIndex: (index: number) => void;
  setSelectedBenchmarkIds: (ids: Set<string>) => void;
  toggleBenchmarkSelection: (id: string) => void;
  clearBenchmarkSelection: () => void;

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
  cacheBenchmarkPage: (page: number, data: Benchmark[]) => void;
  getCachedBenchmarkPage: (page: number) => Benchmark[] | undefined;
  cacheBenchmarkRunPage: (page: number, data: BenchmarkRun[]) => void;
  getCachedBenchmarkRunPage: (page: number) => BenchmarkRun[] | undefined;
  cacheScenarioRunPage: (page: number, data: ScenarioRun[]) => void;
  getCachedScenarioRunPage: (page: number) => ScenarioRun[] | undefined;
  clearCache: () => void;
  clearAll: () => void;

  // Selectors
  getSelectedBenchmark: () => Benchmark | undefined;
  getSelectedBenchmarkRun: () => BenchmarkRun | undefined;
  getSelectedScenarioRun: () => ScenarioRun | undefined;
}

const MAX_CACHE_SIZE = 10;

export const useBenchmarkStore = create<BenchmarkState>((set, get) => ({
  // Initial benchmark (definition) state
  benchmarks: [],
  benchmarksLoading: false,
  benchmarksError: null,
  benchmarksTotalCount: 0,
  benchmarksHasMore: false,
  benchmarksCurrentPage: 0,
  selectedBenchmarkIndex: 0,
  selectedBenchmarkIds: new Set<string>(),

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
  benchmarkPageCache: new Map(),
  benchmarkRunPageCache: new Map(),
  scenarioRunPageCache: new Map(),

  // Benchmark (definition) Actions
  setBenchmarks: (benchmarks) => set({ benchmarks }),
  setBenchmarksLoading: (loading) => set({ benchmarksLoading: loading }),
  setBenchmarksError: (error) => set({ benchmarksError: error }),
  setBenchmarksTotalCount: (count) => set({ benchmarksTotalCount: count }),
  setBenchmarksHasMore: (hasMore) => set({ benchmarksHasMore: hasMore }),
  setBenchmarksCurrentPage: (page) => set({ benchmarksCurrentPage: page }),
  setSelectedBenchmarkIndex: (index) => set({ selectedBenchmarkIndex: index }),
  setSelectedBenchmarkIds: (ids) => set({ selectedBenchmarkIds: ids }),
  toggleBenchmarkSelection: (id) => {
    const state = get();
    const next = new Set(state.selectedBenchmarkIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ selectedBenchmarkIds: next });
  },
  clearBenchmarkSelection: () => set({ selectedBenchmarkIds: new Set() }),

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
  cacheBenchmarkPage: (page, data) => {
    const state = get();
    const cache = state.benchmarkPageCache;

    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    const plainData = data.map(
      (d) => JSON.parse(JSON.stringify(d)) as Benchmark,
    );
    cache.set(page, plainData);
    set({});
  },

  getCachedBenchmarkPage: (page) => {
    return get().benchmarkPageCache.get(page);
  },

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
    state.benchmarkPageCache.clear();
    state.benchmarkRunPageCache.clear();
    state.scenarioRunPageCache.clear();

    set({
      benchmarkPageCache: new Map(),
      benchmarkRunPageCache: new Map(),
      scenarioRunPageCache: new Map(),
    });
  },

  clearAll: () => {
    const state = get();
    state.benchmarkPageCache.clear();
    state.benchmarkRunPageCache.clear();
    state.scenarioRunPageCache.clear();

    set({
      benchmarks: [],
      benchmarksLoading: false,
      benchmarksError: null,
      benchmarksTotalCount: 0,
      benchmarksHasMore: false,
      benchmarksCurrentPage: 0,
      selectedBenchmarkIndex: 0,
      selectedBenchmarkIds: new Set(),
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
      benchmarkPageCache: new Map(),
      benchmarkRunPageCache: new Map(),
      scenarioRunPageCache: new Map(),
    });
  },

  getSelectedBenchmark: () => {
    const state = get();
    return state.benchmarks[state.selectedBenchmarkIndex];
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

/**
 * Benchmark Job Store - Manages benchmark job state
 */
import { create } from "zustand";
import type { BenchmarkJob } from "../services/benchmarkJobService.js";

// Re-export type for convenience
export type { BenchmarkJob };

interface BenchmarkJobState {
  // Benchmark jobs
  benchmarkJobs: BenchmarkJob[];
  benchmarkJobsLoading: boolean;
  benchmarkJobsError: Error | null;
  benchmarkJobsTotalCount: number;
  benchmarkJobsHasMore: boolean;
  benchmarkJobsCurrentPage: number;

  // Selection
  selectedBenchmarkJobIndex: number;

  // Caching
  benchmarkJobPageCache: Map<number, BenchmarkJob[]>;

  // Actions
  setBenchmarkJobs: (jobs: BenchmarkJob[]) => void;
  setBenchmarkJobsLoading: (loading: boolean) => void;
  setBenchmarkJobsError: (error: Error | null) => void;
  setBenchmarkJobsTotalCount: (count: number) => void;
  setBenchmarkJobsHasMore: (hasMore: boolean) => void;
  setBenchmarkJobsCurrentPage: (page: number) => void;
  setSelectedBenchmarkJobIndex: (index: number) => void;

  // Cache management
  cacheBenchmarkJobPage: (page: number, data: BenchmarkJob[]) => void;
  getCachedBenchmarkJobPage: (page: number) => BenchmarkJob[] | undefined;
  clearCache: () => void;
  clearAll: () => void;

  // Selectors
  getSelectedBenchmarkJob: () => BenchmarkJob | undefined;
}

const MAX_CACHE_SIZE = 10;

export const useBenchmarkJobStore = create<BenchmarkJobState>((set, get) => ({
  // Initial state
  benchmarkJobs: [],
  benchmarkJobsLoading: false,
  benchmarkJobsError: null,
  benchmarkJobsTotalCount: 0,
  benchmarkJobsHasMore: false,
  benchmarkJobsCurrentPage: 0,

  // Selection
  selectedBenchmarkJobIndex: 0,

  // Cache
  benchmarkJobPageCache: new Map(),

  // Actions
  setBenchmarkJobs: (jobs) => set({ benchmarkJobs: jobs }),
  setBenchmarkJobsLoading: (loading) => set({ benchmarkJobsLoading: loading }),
  setBenchmarkJobsError: (error) => set({ benchmarkJobsError: error }),
  setBenchmarkJobsTotalCount: (count) => set({ benchmarkJobsTotalCount: count }),
  setBenchmarkJobsHasMore: (hasMore) => set({ benchmarkJobsHasMore: hasMore }),
  setBenchmarkJobsCurrentPage: (page) => set({ benchmarkJobsCurrentPage: page }),
  setSelectedBenchmarkJobIndex: (index) => set({ selectedBenchmarkJobIndex: index }),

  // Cache management
  cacheBenchmarkJobPage: (page, data) => {
    const state = get();
    const cache = state.benchmarkJobPageCache;

    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    const plainData = data.map((d) => JSON.parse(JSON.stringify(d)) as BenchmarkJob);
    cache.set(page, plainData);
    set({});
  },

  getCachedBenchmarkJobPage: (page) => {
    return get().benchmarkJobPageCache.get(page);
  },

  clearCache: () => {
    const state = get();
    state.benchmarkJobPageCache.clear();
    set({ benchmarkJobPageCache: new Map() });
  },

  clearAll: () => {
    const state = get();
    state.benchmarkJobPageCache.clear();

    set({
      benchmarkJobs: [],
      benchmarkJobsLoading: false,
      benchmarkJobsError: null,
      benchmarkJobsTotalCount: 0,
      benchmarkJobsHasMore: false,
      benchmarkJobsCurrentPage: 0,
      selectedBenchmarkJobIndex: 0,
      benchmarkJobPageCache: new Map(),
    });
  },

  getSelectedBenchmarkJob: () => {
    const state = get();
    return state.benchmarkJobs[state.selectedBenchmarkJobIndex];
  },
}));

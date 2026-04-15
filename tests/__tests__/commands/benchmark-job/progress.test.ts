/**
 * Tests for benchmark job progress helpers
 *
 * These tests verify that the progress reconciliation logic correctly
 * handles the case where a job is completed but the prior progress
 * snapshot still had scenario runs marked as running.
 */

import { describe, it, expect } from "@jest/globals";
import {
  isJobCompleted,
  isScenarioCompleted,
  JOB_COMPLETED_STATES,
  SCENARIO_COMPLETED_STATES,
  fetchAllRunsProgress,
  calculateRunProgress,
  type RunProgress,
} from "@/commands/benchmark-job/progress.js";
import type { BenchmarkJob } from "@/services/benchmarkJobService.js";

describe("isJobCompleted", () => {
  it("should return true for completed states", () => {
    expect(isJobCompleted("completed")).toBe(true);
    expect(isJobCompleted("failed")).toBe(true);
    expect(isJobCompleted("canceled")).toBe(true);
    expect(isJobCompleted("cancelled")).toBe(true);
    expect(isJobCompleted("timeout")).toBe(true);
  });

  it("should return false for in-progress states", () => {
    expect(isJobCompleted("running")).toBe(false);
    expect(isJobCompleted("queued")).toBe(false);
    expect(isJobCompleted("initializing")).toBe(false);
  });

  it("should return false for null/undefined", () => {
    expect(isJobCompleted(null)).toBe(false);
    expect(isJobCompleted(undefined)).toBe(false);
    expect(isJobCompleted("")).toBe(false);
  });

  it("should be case insensitive", () => {
    expect(isJobCompleted("COMPLETED")).toBe(true);
    expect(isJobCompleted("Completed")).toBe(true);
    expect(isJobCompleted("FAILED")).toBe(true);
  });
});

describe("isScenarioCompleted", () => {
  it("should return true for completed states", () => {
    expect(isScenarioCompleted("completed")).toBe(true);
    expect(isScenarioCompleted("failed")).toBe(true);
    expect(isScenarioCompleted("canceled")).toBe(true);
    expect(isScenarioCompleted("cancelled")).toBe(true);
    expect(isScenarioCompleted("timeout")).toBe(true);
    expect(isScenarioCompleted("error")).toBe(true);
  });

  it("should treat scored as completed", () => {
    expect(isScenarioCompleted("scored")).toBe(true);
  });

  it("should return false for in-progress states", () => {
    expect(isScenarioCompleted("running")).toBe(false);
    expect(isScenarioCompleted("scoring")).toBe(false);
    expect(isScenarioCompleted("pending")).toBe(false);
  });

  it("should return false for null/undefined", () => {
    expect(isScenarioCompleted(null)).toBe(false);
    expect(isScenarioCompleted(undefined)).toBe(false);
    expect(isScenarioCompleted("")).toBe(false);
  });
});

describe("calculateRunProgress", () => {
  it("should count scored scenarios as finished", () => {
    const scenarioRuns = [
      { state: "completed", scoring_contract_result: { score: 1.0 } },
      { state: "scored", scoring_contract_result: { score: 0.5 } },
      { state: "running" },
    ] as any[];

    const progress = calculateRunProgress(
      "run_123",
      "test-agent",
      undefined,
      "running",
      3,
      scenarioRuns,
    );

    expect(progress.finished).toBe(2);
    expect(progress.running).toBe(1);
    expect(progress.scoring).toBe(0);
  });

  it("should count scoring scenarios separately", () => {
    const scenarioRuns = [
      { state: "completed", scoring_contract_result: { score: 1.0 } },
      { state: "scoring" },
      { state: "running" },
    ] as any[];

    const progress = calculateRunProgress(
      "run_123",
      "test-agent",
      undefined,
      "running",
      3,
      scenarioRuns,
    );

    expect(progress.finished).toBe(1);
    expect(progress.scoring).toBe(1);
    expect(progress.running).toBe(1);
  });

  it("should calculate average score from completed scenarios", () => {
    const scenarioRuns = [
      { state: "completed", scoring_contract_result: { score: 1.0 } },
      { state: "completed", scoring_contract_result: { score: 0.5 } },
      { state: "scored", scoring_contract_result: { score: 0.0 } },
    ] as any[];

    const progress = calculateRunProgress(
      "run_123",
      "test-agent",
      undefined,
      "completed",
      3,
      scenarioRuns,
    );

    expect(progress.avgScore).toBe(0.5);
  });
});

describe("fetchAllRunsProgress", () => {
  it("should prefer completed outcomes over in-progress runs for same benchmark_run_id", async () => {
    const job: Partial<BenchmarkJob> = {
      job_spec: {
        scenario_ids: ["s1", "s2", "s3"],
      } as any,
      benchmark_outcomes: [
        {
          benchmark_run_id: "run_123",
          agent_name: "test-agent",
          model_name: "gpt-4",
          average_score: 0.8,
          n_completed: 3,
          n_failed: 0,
          n_timeout: 0,
          scenario_outcomes: [
            { score: 1.0 },
            { score: 0.7 },
            { score: 0.7 },
          ] as any[],
        },
      ],
      in_progress_runs: [
        {
          benchmark_run_id: "run_123",
          state: "running",
          agent_config: { type: "job_agent", name: "test-agent" },
        } as any,
      ],
    };

    const mockFetchScenarioRuns = async () => [];
    const progress = await fetchAllRunsProgress(
      job as BenchmarkJob,
      mockFetchScenarioRuns,
    );

    expect(progress).toHaveLength(1);
    expect(progress[0].state).toBe("completed");
    expect(progress[0].running).toBe(0);
    expect(progress[0].finished).toBe(3);
  });

  it("should include in-progress runs that are not in completed outcomes", async () => {
    const job: Partial<BenchmarkJob> = {
      job_spec: {
        scenario_ids: ["s1", "s2", "s3"],
      } as any,
      benchmark_outcomes: [
        {
          benchmark_run_id: "run_completed",
          agent_name: "agent-1",
          average_score: 0.8,
          n_completed: 3,
          n_failed: 0,
          n_timeout: 0,
          scenario_outcomes: [{ score: 0.8 }] as any[],
        },
      ],
      in_progress_runs: [
        {
          benchmark_run_id: "run_in_progress",
          state: "running",
          agent_config: { type: "job_agent", name: "agent-2" },
        } as any,
      ],
    };

    const mockFetchScenarioRuns = async () => [
      { state: "completed", scoring_contract_result: { score: 1.0 } },
      { state: "running" },
    ] as any[];

    const progress = await fetchAllRunsProgress(
      job as BenchmarkJob,
      mockFetchScenarioRuns,
    );

    expect(progress).toHaveLength(2);
    expect(progress[0].benchmarkRunId).toBe("run_completed");
    expect(progress[0].state).toBe("completed");
    expect(progress[1].benchmarkRunId).toBe("run_in_progress");
    expect(progress[1].running).toBe(1);
    expect(progress[1].finished).toBe(1);
  });

  it("should handle job with no runs", async () => {
    const job: Partial<BenchmarkJob> = {
      benchmark_outcomes: [],
      in_progress_runs: [],
    };

    const mockFetchScenarioRuns = async () => [];
    const progress = await fetchAllRunsProgress(
      job as BenchmarkJob,
      mockFetchScenarioRuns,
    );

    expect(progress).toHaveLength(0);
  });

  it("should handle the bug case: completed job with stale in-progress snapshot", async () => {
    // This is the specific bug case from the user report:
    // - Job state is completed
    // - benchmark_outcomes shows all scenarios finished
    // - in_progress_runs still contains a run (stale data from previous poll)
    const job: Partial<BenchmarkJob> = {
      state: "completed",
      job_spec: {
        scenario_ids: Array(60).fill("s"),
      } as any,
      benchmark_outcomes: [
        {
          benchmark_run_id: "run_123",
          agent_name: "claude-code:claude-haiku-4",
          average_score: 0.88,
          n_completed: 60,
          n_failed: 0,
          n_timeout: 0,
          scenario_outcomes: Array(60).fill({
            score: 0.88,
            state: "completed",
          }),
        },
      ],
      in_progress_runs: [
        {
          benchmark_run_id: "run_123",
          state: "running",
          agent_config: {
            type: "job_agent",
            name: "claude-code:claude-haiku-4",
          },
        } as any,
      ],
    };

    const mockFetchScenarioRuns = async () => {
      // Even if the scenario runs endpoint returns stale data...
      return [
        ...Array(59).fill({
          state: "completed",
          scoring_contract_result: { score: 0.88 },
        }),
        { state: "running" },
      ] as any[];
    };

    const progress = await fetchAllRunsProgress(
      job as BenchmarkJob,
      mockFetchScenarioRuns,
    );

    // Should only have 1 run (from completed outcomes)
    expect(progress).toHaveLength(1);

    // Should show as completed, not running
    expect(progress[0].state).toBe("completed");
    expect(progress[0].finished).toBe(60);
    expect(progress[0].running).toBe(0);
    expect(progress[0].avgScore).toBeCloseTo(0.88);
  });
});

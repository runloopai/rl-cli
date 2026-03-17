/**
 * Shared benchmark job progress helpers
 *
 * Provides terminal-state classification and run reconciliation logic
 * used by watch, summary, and detail views.
 */

import type {
  BenchmarkJob,
  ScenarioRun,
} from "../../services/benchmarkJobService.js";

// ---------------------------------------------------------------------------
// State Classification
// ---------------------------------------------------------------------------

/** Job states that indicate completion */
export const JOB_COMPLETED_STATES = [
  "completed",
  "failed",
  "canceled",
  "cancelled",
  "timeout",
];

/** Scenario run states that count as finished (no longer running) */
export const SCENARIO_COMPLETED_STATES = [
  "completed",
  "failed",
  "canceled",
  "cancelled",
  "timeout",
  "error",
  "scored", // treat scored as complete, consistent with run detail screen
];

/** Check if a job is in a terminal state */
export function isJobCompleted(state: string | undefined | null): boolean {
  if (!state) return false;
  return JOB_COMPLETED_STATES.includes(state.toLowerCase());
}

/** Check if a scenario is in a terminal state */
export function isScenarioCompleted(state: string | undefined | null): boolean {
  if (!state) return false;
  return SCENARIO_COMPLETED_STATES.includes(state.toLowerCase());
}

// ---------------------------------------------------------------------------
// Progress Stats
// ---------------------------------------------------------------------------

/** In-progress scenario info for display */
export interface InProgressScenario {
  name: string;
  state: string;
  startTimeMs?: number;
}

/** Progress stats for a benchmark run */
export interface RunProgress {
  benchmarkRunId: string;
  agentName: string;
  modelName?: string;
  state: string;
  expectedTotal: number;
  started: number;
  running: number;
  scoring: number;
  finished: number;
  avgScore: number | null;
  inProgressScenarios: InProgressScenario[];
}

// ---------------------------------------------------------------------------
// Agent Info Extraction
// ---------------------------------------------------------------------------

type InProgressRun = NonNullable<BenchmarkJob["in_progress_runs"]>[number];

/** Get agent info from in_progress_run */
export function getAgentInfo(run: InProgressRun): {
  name: string;
  model?: string;
} {
  const agentConfig = run.agent_config;
  if (agentConfig && agentConfig.type === "job_agent") {
    return {
      name: agentConfig.name,
      model: agentConfig.model_name ?? undefined,
    };
  }
  return { name: "unknown" };
}

// ---------------------------------------------------------------------------
// Progress Calculation
// ---------------------------------------------------------------------------

/** Calculate progress from scenario runs */
export function calculateRunProgress(
  benchmarkRunId: string,
  agentName: string,
  modelName: string | undefined,
  state: string,
  expectedTotal: number,
  scenarioRuns: ScenarioRun[],
): RunProgress {
  let running = 0;
  let scoring = 0;
  let finished = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  const inProgressScenarios: InProgressScenario[] = [];

  for (const scenario of scenarioRuns) {
    const scenarioState = scenario.state?.toLowerCase() || "";

    if (isScenarioCompleted(scenarioState)) {
      finished++;
      const score = scenario.scoring_contract_result?.score;
      if (score !== undefined && score !== null) {
        scoreSum += score;
        scoreCount++;
      }
    } else if (scenarioState === "scoring") {
      scoring++;
      inProgressScenarios.push({
        name: scenario.name || scenario.scenario_id || "unknown",
        state: scenarioState,
        startTimeMs: scenario.start_time_ms,
      });
    } else if (scenarioState === "running") {
      running++;
      inProgressScenarios.push({
        name: scenario.name || scenario.scenario_id || "unknown",
        state: scenarioState,
        startTimeMs: scenario.start_time_ms,
      });
    } else if (scenarioState && scenarioState !== "pending") {
      inProgressScenarios.push({
        name: scenario.name || scenario.scenario_id || "unknown",
        state: scenarioState,
        startTimeMs: scenario.start_time_ms,
      });
    }
  }

  return {
    benchmarkRunId,
    agentName,
    modelName,
    state,
    expectedTotal,
    started: scenarioRuns.length,
    running,
    scoring,
    finished,
    avgScore: scoreCount > 0 ? scoreSum / scoreCount : null,
    inProgressScenarios,
  };
}

// ---------------------------------------------------------------------------
// Run Reconciliation
// ---------------------------------------------------------------------------

/**
 * Build progress for all runs in a job, preferring completed outcomes over
 * stale in-progress data for the same benchmark_run_id.
 *
 * @param job The benchmark job
 * @param fetchScenarioRuns Callback to fetch scenario runs for a benchmark run
 */
export async function fetchAllRunsProgress(
  job: BenchmarkJob,
  fetchScenarioRuns: (benchmarkRunId: string) => Promise<ScenarioRun[]>,
): Promise<RunProgress[]> {
  const results: RunProgress[] = [];

  // Get expected scenario count from job spec
  const expectedTotal = job.job_spec?.scenario_ids?.length || 0;

  // Track which runs we've already added from completed outcomes
  const completedRunIds = new Set<string>();

  // First, add completed runs from benchmark_outcomes (authoritative)
  const completedOutcomes = job.benchmark_outcomes || [];
  for (const outcome of completedOutcomes) {
    completedRunIds.add(outcome.benchmark_run_id);

    const scenarioOutcomes = outcome.scenario_outcomes || [];
    let scoreSum = 0;
    let scoreCount = 0;
    for (const s of scenarioOutcomes) {
      if (s.score !== undefined && s.score !== null) {
        scoreSum += s.score;
        scoreCount++;
      }
    }
    results.push({
      benchmarkRunId: outcome.benchmark_run_id,
      agentName: outcome.agent_name,
      modelName: outcome.model_name ?? undefined,
      state: "completed",
      expectedTotal: expectedTotal || scenarioOutcomes.length,
      started: scenarioOutcomes.length,
      running: 0,
      scoring: 0,
      finished: scenarioOutcomes.length,
      avgScore: scoreCount > 0 ? scoreSum / scoreCount : null,
      inProgressScenarios: [],
    });
  }

  // Then, fetch progress for in-progress runs that are NOT already in outcomes
  const inProgressRuns = job.in_progress_runs || [];
  const progressPromises = inProgressRuns
    .filter((run) => !completedRunIds.has(run.benchmark_run_id))
    .map(async (run) => {
      const agentInfo = getAgentInfo(run);
      const scenarioRuns = await fetchScenarioRuns(run.benchmark_run_id);
      return calculateRunProgress(
        run.benchmark_run_id,
        agentInfo.name,
        agentInfo.model,
        run.state,
        expectedTotal,
        scenarioRuns,
      );
    });

  const inProgressResults = await Promise.all(progressPromises);
  results.push(...inProgressResults);

  return results;
}

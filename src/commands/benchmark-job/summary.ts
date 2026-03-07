/**
 * Summary benchmark job command
 */

import chalk from "chalk";
import {
  getBenchmarkJob,
  listBenchmarkRunScenarioRuns,
  type BenchmarkJob,
  type ScenarioRun,
} from "../../services/benchmarkJobService.js";
import { output, outputError } from "../../utils/output.js";

interface SummaryOptions {
  output?: string;
  extended?: boolean;
}

// Job states that indicate completion
const COMPLETED_STATES = ["completed", "failed", "canceled", "timeout"];

// Scenario run states that indicate completion
const SCENARIO_COMPLETED_STATES = [
  "completed",
  "failed",
  "canceled",
  "timeout",
  "error",
];

// Format percentage
function formatPercent(count: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((count / total) * 100).toFixed(1) + "%";
}

// Progress stats for a benchmark run
interface RunProgress {
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
}

// Calculate progress from scenario runs
function calculateRunProgress(
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

  for (const scenario of scenarioRuns) {
    const scenarioState = scenario.state?.toLowerCase() || "";

    if (SCENARIO_COMPLETED_STATES.includes(scenarioState)) {
      finished++;
      const score = scenario.scoring_contract_result?.score;
      if (score !== undefined && score !== null) {
        scoreSum += score;
        scoreCount++;
      }
    } else if (scenarioState === "scoring" || scenarioState === "scored") {
      scoring++;
    } else if (scenarioState === "running") {
      running++;
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
  };
}

// In-progress run type
type InProgressRun = NonNullable<BenchmarkJob["in_progress_runs"]>[number];

// Get agent info from in_progress_run
function getAgentInfo(run: InProgressRun): {
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

// Fetch progress for all runs (in-progress and completed)
async function fetchAllRunsProgress(job: BenchmarkJob): Promise<RunProgress[]> {
  const results: RunProgress[] = [];

  // Get expected scenario count from job spec
  const expectedTotal = job.job_spec?.scenario_ids?.length || 0;

  // First, add completed runs from benchmark_outcomes
  const completedOutcomes = job.benchmark_outcomes || [];
  for (const outcome of completedOutcomes) {
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
    });
  }

  // Then, fetch progress for in-progress runs
  const inProgressRuns = job.in_progress_runs || [];
  const progressPromises = inProgressRuns.map(async (run) => {
    const agentInfo = getAgentInfo(run);
    const scenarioRuns = await listBenchmarkRunScenarioRuns(
      run.benchmark_run_id,
    );
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

// Format a single run's progress line
function formatRunProgressLine(progress: RunProgress): string {
  // Format agent/model label
  let label = progress.agentName;
  if (progress.modelName) {
    label += `:${progress.modelName}`;
  }
  if (label.length > 30) {
    label = label.slice(0, 27) + "...";
  }

  // Use expectedTotal if available, otherwise use started count
  const total =
    progress.expectedTotal > 0 ? progress.expectedTotal : progress.started;

  // Check if this run is complete
  const isComplete = progress.finished === total && total > 0;

  if (isComplete) {
    // Completed run - show green checkmark and final score
    const scoreStr =
      progress.avgScore !== null
        ? `score: ${(progress.avgScore * 100).toFixed(0)}%`
        : "done";
    return `${chalk.green("✓")} ${label.padEnd(30)} ${chalk.green(scoreStr)}`;
  }

  // In-progress run
  const parts: string[] = [];
  parts.push(`${progress.finished}/${total} complete`);

  if (progress.running > 0) {
    parts.push(`${progress.running} running`);
  }

  if (progress.scoring > 0) {
    parts.push(`${progress.scoring} scoring`);
  }

  if (progress.avgScore !== null) {
    parts.push(`score: ${(progress.avgScore * 100).toFixed(0)}%`);
  }

  return `  ${label.padEnd(30)} ${parts.join(", ")}`;
}

// Print progress for in-progress jobs
function printProgress(progressList: RunProgress[]): void {
  if (progressList.length === 0) {
    console.log(chalk.dim("No runs in progress"));
    return;
  }

  console.log(chalk.bold("Progress:"));

  for (const progress of progressList) {
    console.log(formatRunProgressLine(progress));
  }
}

// Print current status (brief)
async function printStatus(job: BenchmarkJob): Promise<void> {
  const jobName = job.name || job.id;
  const state = job.state || "unknown";

  console.log(`Job: ${jobName}`);
  console.log(`ID: ${job.id}`);
  console.log(`State: ${state}`);

  if (!COMPLETED_STATES.includes(state)) {
    // Fetch and show progress for in-progress runs
    console.log();
    const progressList = await fetchAllRunsProgress(job);
    printProgress(progressList);
  }
}

// Calculate stats for completed scenario outcomes
interface CompletedStats {
  total: number;
  passed: number;
  failedZero: number;
  failedError: number;
}

function calculateCompletedStats(
  outcomes: NonNullable<
    NonNullable<BenchmarkJob["benchmark_outcomes"]>[0]["scenario_outcomes"]
  >,
): CompletedStats {
  let passed = 0;
  let failedZero = 0;
  let failedError = 0;

  for (const outcome of outcomes) {
    const state = outcome.state?.toUpperCase();
    const score = outcome.score;

    if (state === "COMPLETED") {
      if (score === 1.0) {
        passed++;
      } else {
        failedZero++;
      }
    } else {
      failedError++;
    }
  }

  return {
    total: outcomes.length,
    passed,
    failedZero,
    failedError,
  };
}

// Print results table for completed jobs
function printResultsTable(job: BenchmarkJob, extended: boolean = false): void {
  const outcomes = job.benchmark_outcomes || [];

  if (outcomes.length === 0) {
    console.log(chalk.yellow("No benchmark outcomes found"));
    return;
  }

  // Header
  console.log();
  console.log(chalk.bold("Benchmark Job Results"));
  console.log(chalk.dim(`Job ID: ${job.id}`));
  if (job.name) {
    console.log(chalk.dim(`Name: ${job.name}`));
  }
  console.log(chalk.dim(`State: ${job.state}`));
  console.log();

  // Table header
  const agentCol = "Agent / Model".padEnd(40);
  const passedCol = "Passed".padStart(10);
  const failedCol = "Failed (0.0)".padStart(14);
  const errorCol = "Failed (error)".padStart(16);
  const totalCol = "Total".padStart(8);

  console.log(
    chalk.bold(agentCol + passedCol + failedCol + errorCol + totalCol),
  );
  console.log(chalk.dim("-".repeat(88)));

  // Print each agent's results
  for (const outcome of outcomes) {
    const agentName = outcome.agent_name || "unknown";
    const modelName = outcome.model_name || "default";
    const scenarioOutcomes = outcome.scenario_outcomes || [];

    const stats = calculateCompletedStats(scenarioOutcomes);

    // Format agent/model column
    let agentModelStr = agentName;
    if (modelName && modelName !== "default") {
      agentModelStr += ` (${modelName})`;
    }
    if (agentModelStr.length > 38) {
      agentModelStr = agentModelStr.slice(0, 35) + "...";
    }
    const agentModelCol = agentModelStr.padEnd(40);

    // Format stats columns with colors
    const passedStr = formatPercent(stats.passed, stats.total);
    const failedZeroStr = formatPercent(stats.failedZero, stats.total);
    const failedErrorStr = formatPercent(stats.failedError, stats.total);

    const passedColored =
      stats.passed > 0
        ? chalk.green(passedStr.padStart(10))
        : chalk.dim(passedStr.padStart(10));

    const failedZeroColored =
      stats.failedZero > 0
        ? chalk.yellow(failedZeroStr.padStart(14))
        : chalk.dim(failedZeroStr.padStart(14));

    const failedErrorColored =
      stats.failedError > 0
        ? chalk.red(failedErrorStr.padStart(16))
        : chalk.dim(failedErrorStr.padStart(16));

    const totalColStr = String(stats.total).padStart(8);

    console.log(
      agentModelCol +
        passedColored +
        failedZeroColored +
        failedErrorColored +
        chalk.dim(totalColStr),
    );

    // Print individual scenario results underneath (indented) when extended
    if (extended) {
      for (const scenario of scenarioOutcomes) {
        const scenarioName =
          scenario.scenario_name ||
          scenario.scenario_definition_id ||
          "unknown";
        const state = scenario.state || "unknown";
        const score = scenario.score;

        let statusIcon: string;
        let statusColor: typeof chalk.green;

        if (state.toUpperCase() === "COMPLETED") {
          if (score === 1.0) {
            statusIcon = chalk.green("\u2713"); // checkmark
            statusColor = chalk.green;
          } else {
            statusIcon = chalk.yellow("\u2717"); // X
            statusColor = chalk.yellow;
          }
        } else {
          statusIcon = chalk.red("!");
          statusColor = chalk.red;
        }

        const scenarioNameTrunc =
          scenarioName.length > 50
            ? scenarioName.slice(0, 47) + "..."
            : scenarioName;

        const scoreStr =
          score !== undefined && score !== null
            ? `score=${score.toFixed(1)}`
            : state;

        console.log(
          chalk.dim("  ") +
            statusIcon +
            " " +
            chalk.dim(scenarioNameTrunc.padEnd(52)) +
            statusColor(scoreStr),
        );
      }
    }
  }

  console.log();
}

export async function summaryBenchmarkJob(
  id: string,
  options: SummaryOptions = {},
) {
  try {
    const job = await getBenchmarkJob(id);
    const isComplete = COMPLETED_STATES.includes(job.state || "");

    if (options.output && options.output !== "text") {
      output(job, { format: options.output, defaultFormat: "json" });
    } else if (isComplete) {
      printResultsTable(job, options.extended);
    } else {
      await printStatus(job);
    }
  } catch (error) {
    outputError("Failed to get benchmark job summary", error);
  }
}

/**
 * Summary benchmark job command
 */

import chalk from "chalk";
import {
  getBenchmarkJob,
  listBenchmarkRunScenarioRuns,
  type BenchmarkJob,
} from "../../services/benchmarkJobService.js";
import { output, outputError } from "../../utils/output.js";
import {
  isJobCompleted,
  fetchAllRunsProgress,
  type RunProgress,
} from "./progress.js";

interface SummaryOptions {
  output?: string;
  extended?: boolean;
}

// Format percentage
function formatPercent(count: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((count / total) * 100).toFixed(1) + "%";
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

  if (!isJobCompleted(state)) {
    // Fetch and show progress for in-progress runs
    console.log();
    const progressList = await fetchAllRunsProgress(
      job,
      listBenchmarkRunScenarioRuns,
    );
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
    if (job.failure_reason) {
      console.log(chalk.red(`Job failed: ${job.failure_reason}`));
    } else {
      console.log(chalk.yellow("No benchmark outcomes found"));
    }
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
    const isComplete = isJobCompleted(job.state);

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

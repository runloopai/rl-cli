/**
 * Status benchmark job command
 */

import chalk from "chalk";
import { getBenchmarkJob } from "../../services/benchmarkJobService.js";
import { output, outputError } from "../../utils/output.js";

interface StatusOptions {
  watch?: boolean;
  output?: string;
}

// Job states that indicate completion
const COMPLETED_STATES = ["completed", "failed", "canceled", "timeout"];

// Polling config
const POLL_INTERVAL_MS = 10 * 1000; // 10 seconds
const MAX_WAIT_MS = 60 * 60 * 4 * 1000; // 4 hours

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ScenarioOutcome {
  scenario_name?: string;
  scenario_definition_id?: string;
  state?: string;
  score?: number;
}

interface BenchmarkOutcome {
  agent_name?: string;
  model_name?: string;
  scenario_outcomes?: ScenarioOutcome[];
}

interface JobData {
  id: string;
  name?: string;
  state?: string;
  benchmark_outcomes?: BenchmarkOutcome[];
}

// Calculate stats for scenario outcomes
function calculateStats(outcomes: ScenarioOutcome[]): {
  total: number;
  passed: number;
  failedZero: number;
  failedError: number;
} {
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
      // Any non-COMPLETED state is an error
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

// Format percentage
function formatPercent(count: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((count / total) * 100).toFixed(1) + "%";
}

// Print current status (brief)
function printStatus(job: JobData): void {
  const jobName = job.name || job.id;
  const state = job.state || "unknown";

  console.log(`Job: ${jobName}`);
  console.log(`ID: ${job.id}`);
  console.log(`State: ${state}`);

  if (COMPLETED_STATES.includes(state)) {
    const outcomes = job.benchmark_outcomes || [];
    if (outcomes.length > 0) {
      let totalScenarios = 0;
      let totalPassed = 0;
      for (const outcome of outcomes) {
        const stats = calculateStats(outcome.scenario_outcomes || []);
        totalScenarios += stats.total;
        totalPassed += stats.passed;
      }
      if (totalScenarios > 0) {
        console.log(
          `Results: ${totalPassed}/${totalScenarios} passed (${formatPercent(totalPassed, totalScenarios)})`,
        );
      }
    }
  }
}

// Print results table
function printResultsTable(job: JobData): void {
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

    const stats = calculateStats(scenarioOutcomes);

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

    // Print individual scenario results underneath (indented)
    for (const scenario of scenarioOutcomes) {
      const scenarioName =
        scenario.scenario_name || scenario.scenario_definition_id || "unknown";
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
        score !== undefined ? `score=${score.toFixed(1)}` : state;

      console.log(
        chalk.dim("  ") +
          statusIcon +
          " " +
          chalk.dim(scenarioNameTrunc.padEnd(52)) +
          statusColor(scoreStr),
      );
    }
  }

  console.log();
}

export async function statusBenchmarkJob(
  id: string,
  options: StatusOptions = {},
) {
  try {
    // Initial fetch
    let job = (await getBenchmarkJob(id)) as unknown as JobData;

    // Check if job is complete
    const isComplete = COMPLETED_STATES.includes(job.state || "");

    // If not waiting or already complete, just print status/results
    if (!options.watch || isComplete) {
      if (options.output && options.output !== "text") {
        output(job, { format: options.output, defaultFormat: "json" });
      } else if (isComplete) {
        printResultsTable(job);
      } else {
        printStatus(job);
      }
      return;
    }

    // Wait mode: poll until complete
    const jobName = job.name || job.id;
    console.log(chalk.cyan(`Awaiting job "${jobName}" completion...`));
    console.log(chalk.dim(`Current state: ${job.state}`));
    console.log();

    const startTime = Date.now();

    while (!COMPLETED_STATES.includes(job.state || "")) {
      // Check timeout
      if (Date.now() - startTime > MAX_WAIT_MS) {
        console.log();
        outputError(
          `Timeout waiting for job completion after ${MAX_WAIT_MS / 1000 / 60} minutes`,
        );
      }

      await sleep(POLL_INTERVAL_MS);
      job = (await getBenchmarkJob(id)) as unknown as JobData;
      process.stdout.write(chalk.dim("."));
    }

    console.log();
    console.log();

    // Output based on format
    if (options.output && options.output !== "text") {
      output(job, { format: options.output, defaultFormat: "json" });
    } else {
      printResultsTable(job);
    }
  } catch (error) {
    outputError("Failed to get benchmark job status", error);
  }
}

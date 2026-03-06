/**
 * Watch benchmark job command - full-screen live progress view
 */

import chalk from "chalk";
import {
  getBenchmarkJob,
  listBenchmarkRunScenarioRuns,
  type BenchmarkJob,
  type ScenarioRun,
} from "../../services/benchmarkJobService.js";
import { outputError } from "../../utils/output.js";

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

// Polling config
const POLL_INTERVAL_MS = 5 * 1000; // 5 seconds
const MAX_WAIT_MS = 60 * 60 * 4 * 1000; // 4 hours

// Sleep utility
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Terminal control utilities for full-screen mode
const ANSI = {
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
  clearScreen: "\x1b[2J",
  moveTo: (row: number, col: number) => `\x1b[${row};${col}H`,
  clearLine: "\x1b[2K",
  enterAltScreen: "\x1b[?1049h",
  exitAltScreen: "\x1b[?1049l",
};

// Enter full-screen mode
function enterFullScreen(): void {
  process.stdout.write(ANSI.enterAltScreen);
  process.stdout.write(ANSI.hideCursor);
  process.stdout.write(ANSI.clearScreen);
}

// Exit full-screen mode
function exitFullScreen(): void {
  process.stdout.write(ANSI.showCursor);
  process.stdout.write(ANSI.exitAltScreen);
}

// Render content at top of screen
function renderScreen(lines: string[]): void {
  process.stdout.write(ANSI.moveTo(1, 1));
  process.stdout.write(ANSI.clearScreen);
  for (const line of lines) {
    console.log(line);
  }
}

// Format percentage
function formatPercent(count: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((count / total) * 100).toFixed(1) + "%";
}

// In-progress scenario info for display
interface InProgressScenario {
  name: string;
  state: string;
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
  inProgressScenarios: InProgressScenario[];
}

// Spinner frames for running indicators
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Get current spinner frame
function getSpinnerFrame(tick: number): string {
  return SPINNER_FRAMES[tick % SPINNER_FRAMES.length];
}

// Calculate max scenarios per run based on terminal height
function getMaxScenariosPerRun(numRuns: number): number {
  const termHeight = process.stdout.rows || 24;
  // Reserve lines for: header (3), footer (2), per-run header (1 per run), buffer (2)
  const reservedLines = 3 + 2 + numRuns + 2;
  const availableLines = Math.max(termHeight - reservedLines, 3);
  // Distribute available lines across runs, minimum 3 per run
  return Math.max(Math.floor(availableLines / Math.max(numRuns, 1)), 3);
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
  const inProgressScenarios: InProgressScenario[] = [];

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
      inProgressScenarios.push({
        name: scenario.name || scenario.scenario_id || "unknown",
        state: scenarioState,
      });
    } else if (scenarioState === "running") {
      running++;
      inProgressScenarios.push({
        name: scenario.name || scenario.scenario_id || "unknown",
        state: scenarioState,
      });
    } else if (scenarioState && scenarioState !== "pending") {
      inProgressScenarios.push({
        name: scenario.name || scenario.scenario_id || "unknown",
        state: scenarioState,
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
      inProgressScenarios: [],
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
  let label = progress.agentName;
  if (progress.modelName) {
    label += `:${progress.modelName}`;
  }
  if (label.length > 30) {
    label = label.slice(0, 27) + "...";
  }

  const total =
    progress.expectedTotal > 0 ? progress.expectedTotal : progress.started;
  const isComplete = progress.finished === total && total > 0;

  if (isComplete) {
    const scoreStr =
      progress.avgScore !== null
        ? `score: ${(progress.avgScore * 100).toFixed(0)}%`
        : "done";
    return `${chalk.green("✓")} ${label.padEnd(30)} ${chalk.green(scoreStr)}`;
  }

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

// Format a scenario state with color and spinner
function formatScenarioState(state: string, tick: number): string {
  const spinner = getSpinnerFrame(tick);
  switch (state.toLowerCase()) {
    case "running":
      return chalk.blue(spinner + " " + state);
    case "scoring":
    case "scored":
      return chalk.magenta(spinner + " " + state);
    case "starting":
    case "queued":
      return chalk.dim(spinner + " " + state);
    default:
      return chalk.dim(state);
  }
}

// Format scenario lines for watch mode
function formatScenarioLines(
  scenarios: InProgressScenario[],
  maxScenarios: number,
  tick: number,
): string[] {
  const limited = scenarios.slice(0, maxScenarios);
  const remaining = scenarios.length - limited.length;

  const lines: string[] = [];
  for (const scenario of limited) {
    let name = scenario.name;
    if (name.length > 45) {
      name = name.slice(0, 42) + "...";
    }
    const stateStr = formatScenarioState(scenario.state, tick);
    lines.push(chalk.dim("      └ ") + chalk.dim(name.padEnd(46)) + stateStr);
  }

  if (remaining > 0) {
    lines.push(chalk.dim(`      ... and ${remaining} more`));
  }

  return lines;
}

// Format progress for watch mode - shows per-run progress with scenarios
function formatWatchProgress(
  progressList: RunProgress[],
  tick: number,
): string[] {
  if (progressList.length === 0) {
    return [];
  }

  const inProgressRuns = progressList.filter((p) => {
    const total = p.expectedTotal > 0 ? p.expectedTotal : p.started;
    return !(p.finished === total && total > 0);
  });
  const maxScenariosPerRun = getMaxScenariosPerRun(inProgressRuns.length || 1);

  const lines: string[] = [];
  for (const progress of progressList) {
    lines.push(formatRunProgressLine(progress));

    const total =
      progress.expectedTotal > 0 ? progress.expectedTotal : progress.started;
    const isComplete = progress.finished === total && total > 0;

    if (!isComplete && progress.inProgressScenarios.length > 0) {
      lines.push(
        ...formatScenarioLines(
          progress.inProgressScenarios,
          maxScenariosPerRun,
          tick,
        ),
      );
    }
  }

  return lines;
}

// Print results table for completed jobs
function printResultsTable(job: BenchmarkJob): void {
  const outcomes = job.benchmark_outcomes || [];

  if (outcomes.length === 0) {
    console.log(chalk.yellow("No benchmark outcomes found"));
    return;
  }

  console.log();
  console.log(chalk.bold("Benchmark Job Results"));
  console.log(chalk.dim(`Job ID: ${job.id}`));
  if (job.name) {
    console.log(chalk.dim(`Name: ${job.name}`));
  }
  console.log(chalk.dim(`State: ${job.state}`));
  console.log();

  const agentCol = "Agent / Model".padEnd(40);
  const passedCol = "Passed".padStart(10);
  const failedCol = "Failed (0.0)".padStart(14);
  const errorCol = "Failed (error)".padStart(16);
  const totalCol = "Total".padStart(8);

  console.log(
    chalk.bold(agentCol + passedCol + failedCol + errorCol + totalCol),
  );
  console.log(chalk.dim("-".repeat(88)));

  for (const outcome of outcomes) {
    const agentName = outcome.agent_name || "unknown";
    const modelName = outcome.model_name || "default";
    const scenarioOutcomes = outcome.scenario_outcomes || [];

    let passed = 0;
    let failedZero = 0;
    let failedError = 0;

    for (const s of scenarioOutcomes) {
      const state = s.state?.toUpperCase();
      const score = s.score;
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

    const total = scenarioOutcomes.length;

    let agentModelStr = agentName;
    if (modelName && modelName !== "default") {
      agentModelStr += ` (${modelName})`;
    }
    if (agentModelStr.length > 38) {
      agentModelStr = agentModelStr.slice(0, 35) + "...";
    }
    const agentModelCol = agentModelStr.padEnd(40);

    const passedStr = formatPercent(passed, total);
    const failedZeroStr = formatPercent(failedZero, total);
    const failedErrorStr = formatPercent(failedError, total);

    const passedColored =
      passed > 0
        ? chalk.green(passedStr.padStart(10))
        : chalk.dim(passedStr.padStart(10));

    const failedZeroColored =
      failedZero > 0
        ? chalk.yellow(failedZeroStr.padStart(14))
        : chalk.dim(failedZeroStr.padStart(14));

    const failedErrorColored =
      failedError > 0
        ? chalk.red(failedErrorStr.padStart(16))
        : chalk.dim(failedErrorStr.padStart(16));

    const totalColStr = String(total).padStart(8);

    console.log(
      agentModelCol +
        passedColored +
        failedZeroColored +
        failedErrorColored +
        chalk.dim(totalColStr),
    );

    for (const scenario of scenarioOutcomes) {
      const scenarioName =
        scenario.scenario_name || scenario.scenario_definition_id || "unknown";
      const state = scenario.state || "unknown";
      const score = scenario.score;

      let statusIcon: string;
      let statusColor: typeof chalk.green;

      if (state.toUpperCase() === "COMPLETED") {
        if (score === 1.0) {
          statusIcon = chalk.green("\u2713");
          statusColor = chalk.green;
        } else {
          statusIcon = chalk.yellow("\u2717");
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

  console.log();
}

export async function watchBenchmarkJob(id: string) {
  try {
    let job = await getBenchmarkJob(id);

    // If job is already complete, just show results
    if (COMPLETED_STATES.includes(job.state || "")) {
      printResultsTable(job);
      return;
    }

    const jobName = job.name || job.id;
    const startTime = Date.now();

    // Enter full-screen mode and set up cleanup
    enterFullScreen();

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      exitFullScreen();
    };

    // Ensure cleanup on any exit
    process.once("exit", cleanup);
    process.once("SIGINT", () => {
      cleanup();
      process.exit(0);
    });
    process.once("SIGTERM", () => {
      cleanup();
      process.exit(0);
    });
    // Handle uncaught errors
    process.once("uncaughtException", (err) => {
      cleanup();
      console.error(err);
      process.exit(1);
    });

    // Spinner update interval (100ms for smooth animation)
    const SPINNER_INTERVAL_MS = 100;
    const UPDATES_PER_POLL = Math.floor(POLL_INTERVAL_MS / SPINNER_INTERVAL_MS);

    try {
      let tick = 0;
      let progressList = await fetchAllRunsProgress(job);

      while (!COMPLETED_STATES.includes(job.state || "")) {
        // Check timeout
        if (Date.now() - startTime > MAX_WAIT_MS) {
          cleanup();
          outputError(
            `Timeout waiting for job completion after ${MAX_WAIT_MS / 1000 / 60} minutes`,
          );
        }

        // Render current state with updated spinner
        const progressLines = formatWatchProgress(progressList, tick);

        // Build screen content
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const elapsedStr = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

        const screenLines: string[] = [];
        screenLines.push(
          chalk.bold.cyan(`Benchmark Job: ${jobName}`) +
            chalk.dim(` (${elapsedStr})`),
        );
        screenLines.push(chalk.dim(`State: ${job.state}`));
        screenLines.push("");

        if (progressLines.length > 0) {
          screenLines.push(chalk.bold("Progress:"));
          screenLines.push(...progressLines);
        } else {
          screenLines.push(chalk.dim("Waiting for scenarios to start..."));
        }

        screenLines.push("");
        screenLines.push(chalk.dim("Press Ctrl+C to exit"));

        // Render the screen
        renderScreen(screenLines);

        tick++;

        // Every UPDATES_PER_POLL ticks, poll the API for fresh data
        if (tick % UPDATES_PER_POLL === 0) {
          job = await getBenchmarkJob(id);
          if (!COMPLETED_STATES.includes(job.state || "")) {
            progressList = await fetchAllRunsProgress(job);
          }
        }

        await sleep(SPINNER_INTERVAL_MS);
      }
    } finally {
      cleanup();
    }

    // Show final results
    printResultsTable(job);
  } catch (error) {
    outputError("Failed to watch benchmark job", error);
  }
}

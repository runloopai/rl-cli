/**
 * Watch benchmark job command - full-screen live progress view
 */

import chalk from "chalk";
import {
  getBenchmarkJob,
  listBenchmarkRunScenarioRuns,
  type BenchmarkJob,
} from "../../services/benchmarkJobService.js";
import { outputError } from "../../utils/output.js";
import {
  isJobCompleted,
  fetchAllRunsProgress,
  type RunProgress,
  type InProgressScenario,
} from "./progress.js";

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

// Track how many lines the last render wrote so we can clear stale lines
let lastRenderedLineCount = 0;

// Render content at top of screen by overwriting lines in place.
// This avoids the flicker caused by clearing the entire screen each frame.
function renderScreen(lines: string[]): void {
  const maxLines = (process.stdout.rows || 24) - 1;
  const truncatedLines = lines.slice(0, maxLines);

  let buf = ANSI.moveTo(1, 1);
  for (const line of truncatedLines) {
    buf += ANSI.clearLine + line + "\n";
  }
  // Clear any leftover lines from the previous (longer) render
  for (let i = truncatedLines.length; i < lastRenderedLineCount; i++) {
    buf += ANSI.clearLine + "\n";
  }
  lastRenderedLineCount = truncatedLines.length;

  process.stdout.write(buf);
}

// Format percentage
function formatPercent(count: number, total: number): string {
  if (total === 0) return "0.0%";
  return ((count / total) * 100).toFixed(1) + "%";
}

// Format duration in human-readable format
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

// Re-export types from shared module for internal use
export type { RunProgress, InProgressScenario };

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
  const now = Date.now();

  const lines: string[] = [];
  for (const scenario of limited) {
    let name = scenario.name;
    if (name.length > 35) {
      name = name.slice(0, 32) + "...";
    }
    const stateStr = formatScenarioState(scenario.state, tick);

    // Calculate elapsed time if start time is available
    let elapsedStr = "";
    if (scenario.startTimeMs) {
      const elapsedMs = now - scenario.startTimeMs;
      elapsedStr = chalk.dim(` (${formatDuration(elapsedMs)})`);
    }

    lines.push(
      chalk.dim("      └ ") +
        chalk.dim(name.padEnd(36)) +
        stateStr +
        elapsedStr,
    );
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
  }

  console.log();
}

export async function watchBenchmarkJob(id: string) {
  try {
    let job = await getBenchmarkJob(id);

    // If job is already complete, just show results
    if (isJobCompleted(job.state)) {
      printResultsTable(job);
      return;
    }

    const jobName = job.name || job.id;
    const jobStartMs = job.create_time_ms;

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

    // Handle terminal resize - force a full redraw to clear stale content
    let needsFullRedraw = false;
    const handleResize = () => {
      needsFullRedraw = true;
    };
    process.stdout.on("resize", handleResize);

    try {
      let tick = 0;
      let progressList = await fetchAllRunsProgress(
        job,
        listBenchmarkRunScenarioRuns,
      );

      while (!isJobCompleted(job.state)) {
        // Check timeout
        if (Date.now() - jobStartMs > MAX_WAIT_MS) {
          cleanup();
          outputError(
            `Timeout waiting for job completion after ${MAX_WAIT_MS / 1000 / 60} minutes`,
          );
        }

        // Render current state with updated spinner
        const progressLines = formatWatchProgress(progressList, tick);

        // Build screen content
        const elapsedStr = formatDuration(Date.now() - jobStartMs);

        const screenLines: string[] = [];
        screenLines.push(
          chalk.bold.cyan(`Benchmark Job: ${jobName}`) +
            chalk.dim(` (${elapsedStr})`),
        );
        screenLines.push(chalk.dim(`ID: ${job.id}`));
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

        // On resize, bump the line count so renderScreen clears the full area
        if (needsFullRedraw) {
          lastRenderedLineCount = process.stdout.rows || 24;
          needsFullRedraw = false;
        }

        // Render the screen
        renderScreen(screenLines);

        tick++;

        // Every UPDATES_PER_POLL ticks, poll the API for fresh data
        if (tick % UPDATES_PER_POLL === 0) {
          job = await getBenchmarkJob(id);
          if (!isJobCompleted(job.state)) {
            progressList = await fetchAllRunsProgress(
              job,
              listBenchmarkRunScenarioRuns,
            );
          }
        }

        await sleep(SPINNER_INTERVAL_MS);
      }

      // Final reconciliation: refresh job and progress one more time to ensure
      // we have the most up-to-date data before printing results. This prevents
      // stale in-progress state from persisting after the job completes.
      job = await getBenchmarkJob(id);
      progressList = await fetchAllRunsProgress(
        job,
        listBenchmarkRunScenarioRuns,
      );
    } finally {
      process.stdout.off("resize", handleResize);
      cleanup();
    }

    // Calculate total elapsed time from job creation
    const totalElapsedStr = formatDuration(Date.now() - jobStartMs);

    // Show completion message
    console.log(chalk.green.bold("Benchmark job completed!"));
    console.log(chalk.dim(`Total time: ${totalElapsedStr}`));

    // Show final results (summary only)
    printResultsTable(job);

    // Show hint for full results
    console.log(
      chalk.dim(
        `To see full results, run: rli benchmark-job summary -e ${job.id}`,
      ),
    );
  } catch (error) {
    outputError("Failed to watch benchmark job", error);
  }
}

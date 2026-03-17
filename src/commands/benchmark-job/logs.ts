/**
 * Download devbox logs for all scenario runs in a benchmark job.
 *
 * Traverses job -> benchmark runs -> scenario runs, downloading and extracting
 * log ZIPs into an organized directory structure: <output-dir>/<agent>/<scenario>/
 *
 * Also writes a results.json with scoring and state info for each scenario run.
 */

import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";
import chalk from "chalk";
import { getClient } from "../../utils/client.js";
import {
  getBenchmarkJob,
  listBenchmarkRunScenarioRuns,
  type BenchmarkJob,
  type ScenarioRun,
} from "../../services/benchmarkJobService.js";
import { outputError } from "../../utils/output.js";
import type { BenchmarkJobView } from "@runloop/api-client/resources/benchmark-jobs";

interface LogsOptions {
  outputDir?: string;
  run?: string;
  scenario?: string;
}

// Info gathered for each benchmark run before downloading logs
interface BenchmarkRunInfo {
  benchmarkRunId: string;
  agentName: string;
  modelName?: string;
}

// A scenario outcome from a completed benchmark run
type ScenarioOutcome = NonNullable<
  BenchmarkJobView["benchmark_outcomes"]
>[number]["scenario_outcomes"][number];

// Info for a single scenario run's log download
interface ScenarioLogTarget {
  agentName: string;
  modelName?: string;
  scenarioName: string;
  scenarioRunId: string;
  scenarioRun: ScenarioRun;
  outcome?: ScenarioOutcome;
  destDir: string;
}

/** Build the agent directory name, including model if present */
function agentDirName(agentName: string, modelName?: string): string {
  if (modelName) {
    return sanitizeDirName(`${agentName}_${modelName}`);
  }
  return sanitizeDirName(agentName);
}

/** Extract agent name and model from an in-progress run's agent config */
function getAgentInfoFromInProgressRun(
  run: NonNullable<BenchmarkJob["in_progress_runs"]>[number],
): { name: string; model?: string } {
  const config = run.agent_config;
  if (config && config.type === "job_agent") {
    return { name: config.name, model: config.model_name ?? undefined };
  }
  return { name: "unknown" };
}

/** Collect benchmark run IDs and agent names from the job */
function collectBenchmarkRuns(job: BenchmarkJob): BenchmarkRunInfo[] {
  const runs: BenchmarkRunInfo[] = [];

  for (const outcome of job.benchmark_outcomes || []) {
    runs.push({
      benchmarkRunId: outcome.benchmark_run_id,
      agentName: outcome.agent_name,
      modelName: outcome.model_name ?? undefined,
    });
  }

  for (const run of job.in_progress_runs || []) {
    const info = getAgentInfoFromInProgressRun(run);
    runs.push({
      benchmarkRunId: run.benchmark_run_id,
      agentName: info.name,
      modelName: info.model,
    });
  }

  return runs;
}

/** Build a map of scenario_run_id -> scenario outcome from completed outcomes */
function buildScenarioOutcomeMap(
  job: BenchmarkJob,
): Map<string, ScenarioOutcome> {
  const map = new Map<string, ScenarioOutcome>();
  for (const outcome of job.benchmark_outcomes || []) {
    for (const scenario of outcome.scenario_outcomes || []) {
      map.set(scenario.scenario_run_id, scenario);
    }
  }
  return map;
}

/** Look up a scenario name, falling back to the API if not in the outcomes map */
async function resolveScenarioName(
  scenarioRunId: string,
  scenarioId: string,
  outcomeMap: Map<string, ScenarioOutcome>,
): Promise<string> {
  const outcome = outcomeMap.get(scenarioRunId);
  if (outcome) return outcome.scenario_name;

  try {
    const client = getClient();
    const scenario = await client.scenarios.retrieve(scenarioId);
    return scenario.name;
  } catch {
    return scenarioId;
  }
}

/** Sanitize a name for use as a directory name */
function sanitizeDirName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").replace(/\s+/g, "-");
}

/**
 * Assign unique destination directories, appending -2, -3, etc. for duplicates.
 * Mutates targets in place, setting destDir on each.
 */
function assignDestDirs(targets: ScenarioLogTarget[], outputDir: string): void {
  const counts = new Map<string, number>();

  for (const target of targets) {
    const baseDir = path.join(
      outputDir,
      agentDirName(target.agentName, target.modelName),
      sanitizeDirName(target.scenarioName),
    );
    const count = (counts.get(baseDir) || 0) + 1;
    counts.set(baseDir, count);
    target.destDir = count === 1 ? baseDir : `${baseDir}-${count}`;
  }

  // If any key had duplicates, rename the first occurrence too (append -1)
  const duplicateKeys = new Set(
    [...counts.entries()].filter(([, c]) => c > 1).map(([k]) => k),
  );
  if (duplicateKeys.size > 0) {
    for (const target of targets) {
      if (target.destDir && duplicateKeys.has(target.destDir)) {
        target.destDir = `${target.destDir}-1`;
      }
    }
  }
}

/** Build a results summary object for a scenario run */
function buildResultsSummary(
  target: ScenarioLogTarget,
): Record<string, unknown> {
  const sr = target.scenarioRun;
  const outcome = target.outcome;

  const summary: Record<string, unknown> = {
    scenario_run_id: sr.id,
    scenario_id: sr.scenario_id,
    scenario_name: target.scenarioName,
    state: outcome?.state || sr.state,
    score: outcome?.score ?? sr.scoring_contract_result?.score ?? null,
    duration_ms: outcome?.duration_ms ?? sr.duration_ms ?? null,
  };

  // Include failure reason if present
  if (outcome?.failure_reason) {
    summary.failure_reason = outcome.failure_reason;
  }

  // Include per-scorer details from the scenario run
  const scoringResults = sr.scoring_contract_result?.scoring_function_results;
  if (scoringResults && scoringResults.length > 0) {
    summary.scoring_functions = scoringResults.map((fn) => ({
      name: fn.scoring_function_name,
      score: fn.score,
      state: fn.state,
      output: fn.output,
    }));
  }

  return summary;
}

/** Download logs ZIP, extract it, and write results.json for a single scenario run */
async function downloadScenarioLogs(
  target: ScenarioLogTarget,
): Promise<boolean> {
  const client = getClient();

  try {
    fs.mkdirSync(target.destDir, { recursive: true });

    // Write results summary
    const results = buildResultsSummary(target);
    fs.writeFileSync(
      path.join(target.destDir, "results.json"),
      JSON.stringify(results, null, 2) + "\n",
    );

    // Download and extract log ZIP
    const response = await client.scenarios.runs.downloadLogs(
      target.scenarioRunId,
    );
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const zip = new AdmZip(buffer);
    const prefix = `${target.scenarioRunId}_`;
    for (const entry of zip.getEntries()) {
      const name = entry.entryName.startsWith(prefix)
        ? entry.entryName.slice(prefix.length)
        : entry.entryName;

      // Prevent Zip Slip / directory traversal by ensuring the target path
      // stays within target.destDir.
      const destPath = path.resolve(target.destDir, name);
      const destRoot = path.resolve(target.destDir) + path.sep;
      if (!destPath.startsWith(destRoot)) {
        console.warn(
          chalk.yellow(
            `  Skipping suspicious log file path in archive: ${entry.entryName}`,
          ),
        );
        continue;
      }

      fs.writeFileSync(destPath, entry.getData());
    }

    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      chalk.yellow(
        `  Warning: failed to download logs for ${target.scenarioName} (${target.scenarioRunId}): ${msg}`,
      ),
    );
    return false;
  }
}

/** Run tasks in parallel with a maximum concurrency limit */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

export async function downloadBenchmarkJobLogs(
  jobId: string,
  options: LogsOptions = {},
) {
  try {
    const job = await getBenchmarkJob(jobId);
    const outputDir = options.outputDir || `./logs/${jobId}`;

    // Collect all benchmark runs from the job
    let runs = collectBenchmarkRuns(job);
    if (runs.length === 0) {
      console.log(chalk.yellow("No benchmark runs found for this job."));
      return;
    }

    // Apply --run filter
    if (options.run) {
      runs = runs.filter((r) => r.benchmarkRunId === options.run);
      if (runs.length === 0) {
        outputError(`Benchmark run ${options.run} not found in job ${jobId}`);
      }
    }

    // Build scenario outcome lookup from completed outcomes
    const outcomeMap = buildScenarioOutcomeMap(job);

    // Gather all scenario log targets across benchmark runs
    const targets: ScenarioLogTarget[] = [];

    for (const run of runs) {
      const agentLabel = run.modelName
        ? `${run.agentName}:${run.modelName}`
        : run.agentName;
      console.log(
        chalk.dim(`Fetching scenario runs for agent "${agentLabel}"...`),
      );
      let scenarioRuns = await listBenchmarkRunScenarioRuns(run.benchmarkRunId);

      // Apply --scenario filter
      if (options.scenario) {
        scenarioRuns = scenarioRuns.filter((sr) => sr.id === options.scenario);
      }

      for (const sr of scenarioRuns) {
        const scenarioName = await resolveScenarioName(
          sr.id,
          sr.scenario_id,
          outcomeMap,
        );
        targets.push({
          agentName: run.agentName,
          modelName: run.modelName,
          scenarioName,
          scenarioRunId: sr.id,
          scenarioRun: sr,
          outcome: outcomeMap.get(sr.id),
          destDir: "", // assigned below
        });
      }
    }

    if (targets.length === 0) {
      console.log(chalk.yellow("No scenario runs found to download logs for."));
      return;
    }

    // Assign unique directory names, handling duplicates
    assignDestDirs(targets, outputDir);

    console.log(
      `\nDownloading logs for ${targets.length} scenario run(s) to ${chalk.bold(outputDir)}\n`,
    );

    // Download logs in parallel with a max concurrency of 50
    const MAX_CONCURRENCY = 50;
    let succeeded = 0;

    const tasks = targets.map((target) => async () => {
      const ok = await downloadScenarioLogs(target);
      if (ok) {
        console.log(
          chalk.green(`  ✓ ${target.agentName} / ${target.scenarioName}`),
        );
        return true;
      }
      return false;
    });

    const results = await runWithConcurrency(tasks, MAX_CONCURRENCY);
    succeeded = results.filter(Boolean).length;

    console.log(
      `\n${chalk.green(`Downloaded logs for ${succeeded}/${targets.length} scenario run(s)`)} to ${chalk.bold(outputDir)}`,
    );
  } catch (error) {
    outputError("Failed to download benchmark job logs", error);
  }
}

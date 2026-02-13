/**
 * BenchmarkJobDetailScreen - Detail page for benchmark jobs
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import {
  useBenchmarkJobStore,
  type BenchmarkJob,
} from "../store/benchmarkJobStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import { getBenchmarkJob } from "../services/benchmarkJobService.js";
import { getBenchmarkRun } from "../services/benchmarkService.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { colors } from "../utils/theme.js";

interface BenchmarkJobDetailScreenProps {
  benchmarkJobId?: string;
}

export function BenchmarkJobDetailScreen({
  benchmarkJobId,
}: BenchmarkJobDetailScreenProps) {
  const { goBack, navigate } = useNavigation();
  const benchmarkJobs = useBenchmarkJobStore((state) => state.benchmarkJobs);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [fetchedJob, setFetchedJob] = React.useState<BenchmarkJob | null>(null);
  const [runNames, setRunNames] = React.useState<Map<string, string>>(
    new Map(),
  );

  // Find job in store first
  const jobFromStore = benchmarkJobs.find((j) => j.id === benchmarkJobId);

  // Polling function
  const pollJob = React.useCallback(async () => {
    if (!benchmarkJobId) return null as unknown as BenchmarkJob;
    return getBenchmarkJob(benchmarkJobId);
  }, [benchmarkJobId]);

  // Fetch job from API if not in store
  React.useEffect(() => {
    if (benchmarkJobId && !loading && !fetchedJob) {
      setLoading(true);
      setError(null);

      getBenchmarkJob(benchmarkJobId)
        .then((job) => {
          setFetchedJob(job);
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [benchmarkJobId, loading, fetchedJob]);

  // Use fetched job for full details, fall back to store for basic display
  const job = fetchedJob || jobFromStore;

  // Fetch run names when job is loaded
  React.useEffect(() => {
    if (!job) return;

    const runIds: string[] = [];

    // Collect run IDs from outcomes
    if (job.benchmark_outcomes) {
      job.benchmark_outcomes.forEach((outcome) => {
        runIds.push(outcome.benchmark_run_id);
      });
    }

    // Collect run IDs from in-progress runs
    if (job.in_progress_runs) {
      job.in_progress_runs.forEach((run) => {
        if (!runIds.includes(run.benchmark_run_id)) {
          runIds.push(run.benchmark_run_id);
        }
      });
    }

    // Fetch run details for each run ID
    Promise.all(
      runIds.map(async (runId) => {
        try {
          const run = await getBenchmarkRun(runId);
          return { id: runId, name: run.name || runId };
        } catch {
          return { id: runId, name: runId };
        }
      }),
    ).then((results) => {
      const namesMap = new Map<string, string>();
      results.forEach((result) => {
        namesMap.set(result.id, result.name);
      });
      setRunNames(namesMap);
    });
  }, [job]);

  // Show loading state
  if (!job && benchmarkJobId && !error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmark Jobs" },
            { label: "Loading...", active: true },
          ]}
        />
        <SpinnerComponent message="Loading benchmark job details..." />
      </>
    );
  }

  // Show error state
  if (error && !job) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmark Jobs" },
            { label: "Error", active: true },
          ]}
        />
        <ErrorMessage
          message="Failed to load benchmark job details"
          error={error}
        />
      </>
    );
  }

  // Show not found error
  if (!job) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmark Jobs" },
            { label: "Not Found", active: true },
          ]}
        />
        <ErrorMessage
          message={`Benchmark job ${benchmarkJobId || "unknown"} not found`}
          error={new Error("Benchmark job not found")}
        />
      </>
    );
  }

  // Helper to format duration
  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  // Build detail sections
  const detailSections: DetailSection[] = [];

  // Basic details section
  const basicFields = [];
  if (job.create_time_ms) {
    basicFields.push({
      label: "Created",
      value: formatTimestamp(job.create_time_ms),
    });
  }

  // Calculate overall score if available
  if (job.benchmark_outcomes && job.benchmark_outcomes.length > 0) {
    const scores = job.benchmark_outcomes
      .map((o) => o.average_score)
      .filter((s): s is number => s !== null && s !== undefined);
    if (scores.length > 0) {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      basicFields.push({
        label: "Overall Score",
        value: (
          <Text color={colors.success} bold>
            {avgScore.toFixed(2)}
          </Text>
        ),
      });
    }
  }

  // Summary stats
  if (job.benchmark_outcomes && job.benchmark_outcomes.length > 0) {
    const totalCompleted = job.benchmark_outcomes.reduce(
      (acc, o) => acc + o.n_completed,
      0,
    );
    const totalFailed = job.benchmark_outcomes.reduce(
      (acc, o) => acc + o.n_failed,
      0,
    );
    const totalTimeout = job.benchmark_outcomes.reduce(
      (acc, o) => acc + o.n_timeout,
      0,
    );
    const total = totalCompleted + totalFailed + totalTimeout;

    basicFields.push({
      label: "Scenarios",
      value: (
        <Text>
          <Text color={colors.success}>{totalCompleted} completed</Text>
          {totalFailed > 0 && (
            <Text color={colors.error}> / {totalFailed} failed</Text>
          )}
          {totalTimeout > 0 && (
            <Text color={colors.warning}> / {totalTimeout} timeout</Text>
          )}
          <Text dimColor> ({total} total)</Text>
        </Text>
      ),
    });
  }

  if (job.failure_reason) {
    basicFields.push({
      label: "Failure Reason",
      value: <Text color={colors.error}>{job.failure_reason}</Text>,
    });
  }

  if (basicFields.length > 0) {
    detailSections.push({
      title: "Summary",
      icon: figures.squareSmallFilled,
      color: colors.warning,
      fields: basicFields,
    });
  }

  // Build a unified view of benchmark runs per agent
  // Collect all agents from job_spec, in_progress_runs, and benchmark_outcomes
  interface AgentRunInfo {
    agentName: string;
    modelName?: string;
    status: "pending" | "running" | "completed" | "failed" | "timeout";
    benchmarkRunId?: string;
    score?: number;
    nCompleted?: number;
    nFailed?: number;
    nTimeout?: number;
    duration?: number;
    startTime?: number;
  }

  const agentRuns: AgentRunInfo[] = [];

  // First, add completed runs from benchmark_outcomes
  if (job.benchmark_outcomes) {
    job.benchmark_outcomes.forEach((outcome) => {
      const total = outcome.n_completed + outcome.n_failed + outcome.n_timeout;
      const status =
        outcome.n_failed > 0 || outcome.n_timeout > 0
          ? outcome.n_completed === 0
            ? "failed"
            : "completed"
          : "completed";

      agentRuns.push({
        agentName: outcome.agent_name,
        modelName: outcome.model_name || undefined,
        status,
        benchmarkRunId: outcome.benchmark_run_id,
        score: outcome.average_score ?? undefined,
        nCompleted: outcome.n_completed,
        nFailed: outcome.n_failed,
        nTimeout: outcome.n_timeout,
        duration: outcome.duration_ms ?? undefined,
      });
    });
  }

  // Add in-progress runs
  if (job.in_progress_runs) {
    job.in_progress_runs.forEach((run) => {
      // Get agent name from agent_config if available
      let agentName = "Unknown Agent";
      if (run.agent_config && "name" in run.agent_config) {
        agentName = (run.agent_config as any).name;
      }

      agentRuns.push({
        agentName,
        status: "running",
        benchmarkRunId: run.benchmark_run_id,
        duration: run.duration_ms ?? undefined,
        startTime: run.start_time_ms,
      });
    });
  }

  // Add pending agents from job_spec that don't have runs yet
  if (job.job_spec?.agent_configs) {
    const runningOrCompletedAgents = new Set(agentRuns.map((r) => r.agentName));

    job.job_spec.agent_configs.forEach((agent) => {
      if (!runningOrCompletedAgents.has(agent.name)) {
        agentRuns.push({
          agentName: agent.name,
          modelName: agent.model_name || undefined,
          status: "pending",
        });
      }
    });
  }

  // Benchmark Runs section - show all agent runs with their status
  if (agentRuns.length > 0) {
    const runsFields = agentRuns.map((run) => {
      const parts: React.ReactNode[] = [];

      // Status indicator
      switch (run.status) {
        case "pending":
          parts.push(
            <Text key="status" color={colors.textDim}>
              {figures.circleDotted} Pending
            </Text>,
          );
          break;
        case "running":
          parts.push(
            <Text key="status" color={colors.info}>
              {figures.play} Running
            </Text>,
          );
          if (run.duration) {
            parts.push(
              <Text key="dur" dimColor>
                {" "}
                ({formatDuration(run.duration)})
              </Text>,
            );
          }
          break;
        case "completed":
          parts.push(
            <Text key="status" color={colors.success}>
              {figures.tick} Completed
            </Text>,
          );
          if (run.score !== undefined) {
            parts.push(
              <Text key="score" color={colors.success} bold>
                {" "}
                Score: {run.score.toFixed(2)}
              </Text>,
            );
          }
          break;
        case "failed":
          parts.push(
            <Text key="status" color={colors.error}>
              {figures.cross} Failed
            </Text>,
          );
          if (run.score !== undefined) {
            parts.push(
              <Text key="score" dimColor>
                {" "}
                Score: {run.score.toFixed(2)}
              </Text>,
            );
          }
          break;
        case "timeout":
          parts.push(
            <Text key="status" color={colors.warning}>
              {figures.warning} Timeout
            </Text>,
          );
          break;
      }

      // Stats for completed/failed runs
      if (run.nCompleted !== undefined) {
        parts.push(
          <Text key="stats" dimColor>
            {" "}
            ({run.nCompleted}✓{run.nFailed ? ` ${run.nFailed}✗` : ""}
            {run.nTimeout ? ` ${run.nTimeout}⏱` : ""})
          </Text>,
        );
      }

      // Duration for completed runs
      if (run.status !== "running" && run.duration) {
        parts.push(
          <Text key="dur" dimColor>
            {" "}
            {formatDuration(run.duration)}
          </Text>,
        );
      }

      // Benchmark Run ID (clickable hint)
      if (run.benchmarkRunId) {
        parts.push(
          <Text key="id" dimColor>
            {"\n"}
            {"  "}
            {figures.arrowRight} Run:{" "}
            <Text color={colors.idColor}>{run.benchmarkRunId}</Text>
          </Text>,
        );
      }

      // Model name
      if (run.modelName) {
        parts.push(
          <Text key="model" dimColor>
            {" "}
            [{run.modelName}]
          </Text>,
        );
      }

      return {
        label: run.agentName,
        value: <Text>{parts}</Text>,
        ...(run.benchmarkRunId
          ? {
              action: {
                type: "navigate" as const,
                screen: "benchmark-run-detail" as const,
                params: { benchmarkRunId: run.benchmarkRunId },
                hint: "View Run",
              },
            }
          : {}),
      };
    });

    const pendingCount = agentRuns.filter((r) => r.status === "pending").length;
    const runningCount = agentRuns.filter((r) => r.status === "running").length;
    const completedCount = agentRuns.filter(
      (r) => r.status === "completed" || r.status === "failed",
    ).length;

    let sectionTitle = `Benchmark Runs (${agentRuns.length} agents)`;
    if (pendingCount > 0 || runningCount > 0) {
      const statusParts: string[] = [];
      if (completedCount > 0) statusParts.push(`${completedCount} done`);
      if (runningCount > 0) statusParts.push(`${runningCount} running`);
      if (pendingCount > 0) statusParts.push(`${pendingCount} pending`);
      sectionTitle = `Benchmark Runs - ${statusParts.join(", ")}`;
    }

    detailSections.push({
      title: sectionTitle,
      icon: figures.pointer,
      color: colors.primary,
      fields: runsFields,
    });
  }

  // Job Configuration section (condensed)
  if (job.job_spec) {
    const spec = job.job_spec;
    const specFields = [];

    if (spec.scenario_ids && spec.scenario_ids.length > 0) {
      specFields.push({
        label: "Scenarios",
        value: `${spec.scenario_ids.length} scenario(s)`,
      });
    }

    if (spec.orchestrator_config) {
      const orch = spec.orchestrator_config;
      const orchParts: string[] = [];
      if (orch.n_concurrent_trials)
        orchParts.push(`${orch.n_concurrent_trials} concurrent`);
      if (orch.n_attempts) orchParts.push(`${orch.n_attempts} retries`);
      if (orch.timeout_multiplier && orch.timeout_multiplier !== 1) {
        orchParts.push(`${orch.timeout_multiplier}x timeout`);
      }
      if (orchParts.length > 0) {
        specFields.push({
          label: "Orchestrator",
          value: orchParts.join(", "),
        });
      }
    }

    if (specFields.length > 0) {
      detailSections.push({
        title: "Job Configuration",
        icon: figures.circleFilled,
        color: colors.secondary,
        fields: specFields,
      });
    }
  }

  // Job Source section
  if (job.job_source) {
    const source = job.job_source;
    const sourceFields = [];

    if ("type" in source) {
      sourceFields.push({
        label: "Source Type",
        value: source.type,
      });
    }
    if ("benchmark_id" in source && source.benchmark_id) {
      sourceFields.push({
        label: "Benchmark ID",
        value: <Text color={colors.idColor}>{source.benchmark_id}</Text>,
        action: {
          type: "navigate" as const,
          screen: "benchmark-detail" as const,
          params: { benchmarkId: source.benchmark_id as string },
          hint: "View Benchmark",
        },
      });
    }

    if (sourceFields.length > 0) {
      detailSections.push({
        title: "Job Source",
        icon: figures.info,
        color: colors.textDim,
        fields: sourceFields,
      });
    }
  }

  // Collect benchmark run IDs for operations
  const benchmarkRunIds: { id: string; name: string }[] = [];
  if (job.benchmark_outcomes) {
    job.benchmark_outcomes.forEach((outcome) => {
      // Use fetched run name from state, fallback to run ID
      const runName =
        runNames.get(outcome.benchmark_run_id) || outcome.benchmark_run_id;
      benchmarkRunIds.push({
        id: outcome.benchmark_run_id,
        name: runName,
      });
    });
  }
  if (job.in_progress_runs) {
    job.in_progress_runs.forEach((run) => {
      // Avoid duplicates
      if (!benchmarkRunIds.find((r) => r.id === run.benchmark_run_id)) {
        // Use fetched run name from state, fallback to run ID
        const runName =
          runNames.get(run.benchmark_run_id) || run.benchmark_run_id;
        benchmarkRunIds.push({ id: run.benchmark_run_id, name: runName });
      }
    });
  }

  // Operations available for benchmark jobs
  const operations: ResourceOperation[] = [];

  // Add "View Run" operations for each benchmark run (limit to first 9 for shortcuts)
  benchmarkRunIds.slice(0, 9).forEach((run, idx) => {
    operations.push({
      key: `view-run-${idx}`,
      label: `View Run: ${run.name}`,
      color: colors.info,
      icon: figures.arrowRight,
      shortcut: String(idx + 1),
    });
  });

  // Always add clone job option
  operations.push({
    key: "clone-job",
    label: "Clone Job",
    color: colors.success,
    icon: figures.play,
    shortcut: "c",
  });

  // Handle operation selection
  const handleOperation = async (operation: string, resource: BenchmarkJob) => {
    if (operation.startsWith("view-run-")) {
      const idx = parseInt(operation.replace("view-run-", ""), 10);
      if (benchmarkRunIds[idx]) {
        navigate("benchmark-run-detail", {
          benchmarkRunId: benchmarkRunIds[idx].id,
        });
      }
    } else if (operation === "clone-job") {
      // Pass job data for cloning
      const cloneParams: any = {
        cloneFromJobId: resource.id,
        cloneJobName: resource.name,
      };

      // Determine source type and extract IDs
      if (resource.job_spec) {
        const spec = resource.job_spec as any;

        // Check if it's a scenarios spec (has scenario_ids array)
        if (spec.scenario_ids && Array.isArray(spec.scenario_ids)) {
          cloneParams.cloneSourceType = "scenarios";
          cloneParams.initialScenarioIds = spec.scenario_ids.join(",");
        }
        // Check if it's a benchmark spec (has benchmark_id)
        else if (spec.benchmark_id) {
          cloneParams.cloneSourceType = "benchmark";
          cloneParams.initialBenchmarkIds = spec.benchmark_id;
        }
        // Fallback: check job_source
        else if (resource.job_source) {
          const source = resource.job_source as any;
          if (source.scenario_ids && Array.isArray(source.scenario_ids)) {
            cloneParams.cloneSourceType = "scenarios";
            cloneParams.initialScenarioIds = source.scenario_ids.join(",");
          } else if (source.benchmark_id) {
            cloneParams.cloneSourceType = "benchmark";
            cloneParams.initialBenchmarkIds = source.benchmark_id;
          }
        }
      }

      // Extract agent configs - both full configs and legacy fields
      if (resource.job_spec?.agent_configs) {
        const agentConfigs = resource.job_spec.agent_configs.map((a: any) => ({
          agentId: a.agent_id,
          name: a.name,
          modelName: a.model_name,
          timeoutSeconds: a.timeout_seconds,
          kwargs: a.kwargs,
          environmentVariables: a.agent_environment?.environment_variables,
          secrets: a.agent_environment?.secrets,
        }));
        cloneParams.cloneAgentConfigs = JSON.stringify(agentConfigs);

        // Also extract legacy fields for form initialization
        cloneParams.cloneAgentIds = resource.job_spec.agent_configs
          .map((a: any) => a.agent_id)
          .join(",");
        cloneParams.cloneAgentNames = resource.job_spec.agent_configs
          .map((a: any) => a.name)
          .join(",");
      }

      // Extract orchestrator config
      if (resource.job_spec?.orchestrator_config) {
        const orch = resource.job_spec.orchestrator_config;
        cloneParams.cloneOrchestratorConfig = JSON.stringify({
          nAttempts: orch.n_attempts,
          nConcurrentTrials: orch.n_concurrent_trials,
          quiet: orch.quiet,
          timeoutMultiplier: orch.timeout_multiplier,
        });
      }

      navigate("benchmark-job-create", cloneParams);
    }
  };

  // Build detailed info lines for full details view
  const buildDetailLines = (j: BenchmarkJob): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        Benchmark Job Details
      </Text>,
    );
    lines.push(
      <Text key="core-id" color={colors.idColor}>
        {" "}
        ID: {j.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {j.name || "(none)"}
      </Text>,
    );
    lines.push(
      <Text key="core-status" dimColor>
        {" "}
        Status: {j.state}
      </Text>,
    );
    if (j.create_time_ms) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Created: {new Date(j.create_time_ms).toLocaleString()}
        </Text>,
      );
    }
    if (j.failure_reason) {
      lines.push(
        <Text key="core-failure" color={colors.error}>
          {" "}
          Failure: {j.failure_reason}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Benchmark Runs - unified view
    lines.push(
      <Text key="runs-title" color={colors.primary} bold>
        Benchmark Runs
      </Text>,
    );

    // Completed runs from benchmark_outcomes
    if (j.benchmark_outcomes && j.benchmark_outcomes.length > 0) {
      j.benchmark_outcomes.forEach((outcome, idx) => {
        const scoreStr =
          outcome.average_score !== undefined && outcome.average_score !== null
            ? `Score: ${outcome.average_score.toFixed(2)}`
            : "No score";
        const statsStr = `${outcome.n_completed}✓ ${outcome.n_failed}✗ ${outcome.n_timeout}⏱`;
        const durationStr = outcome.duration_ms
          ? formatDuration(outcome.duration_ms)
          : "";
        const statusIcon = outcome.n_failed > 0 ? figures.cross : figures.tick;
        const statusColor =
          outcome.n_failed > 0 ? colors.error : colors.success;

        lines.push(
          <Text key={`outcome-${idx}`}>
            {" "}
            <Text color={statusColor}>{statusIcon}</Text>
            <Text color={colors.info}>
              {" "}
              {outcome.agent_name || `Agent ${idx + 1}`}
            </Text>
            <Text dimColor>
              : {scoreStr} ({statsStr}) {durationStr}
            </Text>
          </Text>,
        );
        lines.push(
          <Text key={`outcome-${idx}-id`} dimColor>
            {"   "}Run ID: {outcome.benchmark_run_id}
          </Text>,
        );

        // Show scenario outcomes
        if (outcome.scenario_outcomes && outcome.scenario_outcomes.length > 0) {
          outcome.scenario_outcomes.forEach((scenario, sIdx) => {
            const scenarioScore =
              scenario.score !== undefined && scenario.score !== null
                ? scenario.score.toFixed(2)
                : "-";
            const scenarioDur = scenario.duration_ms
              ? formatDuration(scenario.duration_ms)
              : "";
            const scenarioIcon =
              scenario.state === "COMPLETED"
                ? figures.tick
                : scenario.state === "FAILED"
                  ? figures.cross
                  : figures.warning;
            const scenarioColor =
              scenario.state === "COMPLETED"
                ? colors.success
                : scenario.state === "FAILED"
                  ? colors.error
                  : colors.warning;
            lines.push(
              <Text key={`outcome-${idx}-scenario-${sIdx}`}>
                {"   "}
                <Text color={scenarioColor}>{scenarioIcon}</Text>
                <Text dimColor>
                  {" "}
                  {scenario.scenario_name}: {scenario.state} (score:{" "}
                  {scenarioScore}) {scenarioDur}
                </Text>
              </Text>,
            );
            if (scenario.failure_reason) {
              lines.push(
                <Text
                  key={`outcome-${idx}-scenario-${sIdx}-fail`}
                  color={colors.error}
                >
                  {"     "}
                  {scenario.failure_reason.exception_type}:{" "}
                  {scenario.failure_reason.exception_message}
                </Text>,
              );
            }
          });
        }
      });
    }

    // In-progress runs
    if (j.in_progress_runs && j.in_progress_runs.length > 0) {
      j.in_progress_runs.forEach((run, idx) => {
        let agentName = "Unknown Agent";
        if (run.agent_config && "name" in run.agent_config) {
          agentName = (run.agent_config as any).name;
        }
        const durationStr = run.duration_ms
          ? formatDuration(run.duration_ms)
          : "";

        lines.push(
          <Text key={`run-${idx}`}>
            {" "}
            <Text color={colors.info}>{figures.play}</Text>
            <Text color={colors.info}> {agentName}</Text>
            <Text dimColor>: Running {durationStr}</Text>
          </Text>,
        );
        lines.push(
          <Text key={`run-${idx}-id`} dimColor>
            {"   "}Run ID: {run.benchmark_run_id}
          </Text>,
        );
      });
    }

    // Pending agents
    if (j.job_spec?.agent_configs) {
      const runningOrCompletedAgents = new Set<string>();
      j.benchmark_outcomes?.forEach((o) =>
        runningOrCompletedAgents.add(o.agent_name),
      );
      j.in_progress_runs?.forEach((r) => {
        if (r.agent_config && "name" in r.agent_config) {
          runningOrCompletedAgents.add((r.agent_config as any).name);
        }
      });

      j.job_spec.agent_configs.forEach((agent, idx) => {
        if (!runningOrCompletedAgents.has(agent.name)) {
          lines.push(
            <Text key={`pending-${idx}`}>
              {" "}
              <Text color={colors.textDim}>{figures.circleDotted}</Text>
              <Text dimColor> {agent.name}: Pending</Text>
            </Text>,
          );
        }
      });
    }

    lines.push(<Text key="runs-space"> </Text>);

    // Job Configuration
    if (j.job_spec) {
      lines.push(
        <Text key="spec-title" color={colors.secondary} bold>
          Job Configuration
        </Text>,
      );
      if (j.job_spec.scenario_ids) {
        lines.push(
          <Text key="spec-scenarios" dimColor>
            {" "}
            Scenarios: {j.job_spec.scenario_ids.length}
          </Text>,
        );
      }
      if (j.job_spec.orchestrator_config) {
        const orch = j.job_spec.orchestrator_config;
        const orchInfo = [];
        if (orch.n_concurrent_trials)
          orchInfo.push(`${orch.n_concurrent_trials} concurrent`);
        if (orch.n_attempts) orchInfo.push(`${orch.n_attempts} retries`);
        if (orchInfo.length > 0) {
          lines.push(
            <Text key="spec-orch" dimColor>
              {" "}
              Orchestrator: {orchInfo.join(", ")}
            </Text>,
          );
        }
      }
      lines.push(<Text key="spec-space"> </Text>);
    }

    // Raw JSON
    lines.push(
      <Text key="json-title" color={colors.warning} bold>
        Raw JSON
      </Text>,
    );
    const jsonLines = JSON.stringify(j, null, 2).split("\n");
    jsonLines.forEach((line, idx) => {
      lines.push(
        <Text key={`json-${idx}`} dimColor>
          {" "}
          {line}
        </Text>,
      );
    });

    return lines;
  };

  // Check if job is still in progress for polling
  const isRunning =
    job.state === "running" ||
    job.state === "queued" ||
    job.state === "initializing";

  return (
    <ResourceDetailPage
      resource={job}
      resourceType="Benchmark Jobs"
      getDisplayName={(j) => j.name || j.id}
      getId={(j) => j.id}
      getStatus={(j) => j.state}
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
      pollResource={isRunning ? pollJob : undefined}
      breadcrumbPrefix={[{ label: "Home" }]}
    />
  );
}

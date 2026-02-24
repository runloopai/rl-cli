/**
 * ScenarioRunDetailScreen - Detail page for scenario runs
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import {
  useBenchmarkStore,
  type ScenarioRun,
} from "../store/benchmarkStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import { getScenarioRun } from "../services/benchmarkService.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb, type BreadcrumbItem } from "../components/Breadcrumb.js";
import { colors } from "../utils/theme.js";

interface ScenarioRunDetailScreenProps {
  scenarioRunId?: string;
  benchmarkRunId?: string;
}

export function ScenarioRunDetailScreen({
  scenarioRunId,
  benchmarkRunId,
}: ScenarioRunDetailScreenProps) {
  const { goBack, navigate } = useNavigation();
  const scenarioRuns = useBenchmarkStore((state) => state.scenarioRuns);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [fetchedRun, setFetchedRun] = React.useState<ScenarioRun | null>(null);

  // Find run in store first
  const runFromStore = scenarioRuns.find((r) => r.id === scenarioRunId);

  // Polling function
  const pollRun = React.useCallback(async () => {
    if (!scenarioRunId) return null as unknown as ScenarioRun;
    return getScenarioRun(scenarioRunId);
  }, [scenarioRunId]);

  // Fetch run from API if not in store
  React.useEffect(() => {
    if (scenarioRunId && !loading && !fetchedRun) {
      setLoading(true);
      setError(null);

      getScenarioRun(scenarioRunId)
        .then((run) => {
          setFetchedRun(run);
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [scenarioRunId, loading, fetchedRun]);

  // Use fetched run for full details, fall back to store for basic display
  const run = fetchedRun || runFromStore;

  // Build breadcrumb items
  const buildBreadcrumbItems = (
    lastLabel: string,
    active = true,
  ): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: "Home" },
      { label: "Benchmarks" },
    ];
    if (benchmarkRunId) {
      items.push({ label: `Run: ${benchmarkRunId.substring(0, 8)}...` });
    }
    items.push({ label: "Scenario Runs" });
    items.push({ label: lastLabel, active });
    return items;
  };

  // Show loading state
  if (!run && scenarioRunId && !error) {
    return (
      <>
        <Breadcrumb items={buildBreadcrumbItems("Loading...")} />
        <SpinnerComponent message="Loading scenario run details..." />
      </>
    );
  }

  // Show error state
  if (error && !run) {
    return (
      <>
        <Breadcrumb items={buildBreadcrumbItems("Error")} />
        <ErrorMessage
          message="Failed to load scenario run details"
          error={error}
        />
      </>
    );
  }

  // Show not found error
  if (!run) {
    return (
      <>
        <Breadcrumb items={buildBreadcrumbItems("Not Found")} />
        <ErrorMessage
          message={`Scenario run ${scenarioRunId || "unknown"} not found`}
          error={new Error("Scenario run not found")}
        />
      </>
    );
  }

  // Build detail sections
  const detailSections: DetailSection[] = [];

  // Basic details section
  const basicFields = [];
  if (run.start_time_ms) {
    basicFields.push({
      label: "Started",
      value: formatTimestamp(run.start_time_ms),
    });
  }
  const endTimeMs =
    run.start_time_ms && run.duration_ms
      ? run.start_time_ms + run.duration_ms
      : undefined;
  if (endTimeMs) {
    basicFields.push({
      label: "Ended",
      value: formatTimestamp(endTimeMs),
    });
  }
  if (run.scenario_id) {
    basicFields.push({
      label: "Scenario ID",
      value: <Text color={colors.idColor}>{run.scenario_id}</Text>,
    });
  }
  if (run.benchmark_run_id) {
    basicFields.push({
      label: "Benchmark Run ID",
      value: <Text color={colors.idColor}>{run.benchmark_run_id}</Text>,
      action: {
        type: "navigate" as const,
        screen: "benchmark-run-detail" as const,
        params: { benchmarkRunId: run.benchmark_run_id },
        hint: "View Run",
      },
    });
  }

  if (basicFields.length > 0) {
    detailSections.push({
      title: "Details",
      icon: figures.squareSmallFilled,
      color: colors.warning,
      fields: basicFields,
    });
  }

  // Results section
  const score = run.scoring_contract_result?.score;
  if (score !== undefined) {
    detailSections.push({
      title: "Results",
      icon: figures.tick,
      color: colors.success,
      fields: [
        {
          label: "Score",
          value: <Text color={colors.info}>{score}</Text>,
        },
      ],
    });
  }

  // Metadata section
  if (run.metadata && Object.keys(run.metadata).length > 0) {
    const metadataFields = Object.entries(run.metadata).map(([key, value]) => ({
      label: key,
      value: value,
    }));

    detailSections.push({
      title: "Metadata",
      icon: figures.identical,
      color: colors.secondary,
      fields: metadataFields,
    });
  }

  // Operations available for scenario runs
  const operations: ResourceOperation[] = [];

  if (run.benchmark_run_id) {
    operations.push({
      key: "view-benchmark-run",
      label: "View Benchmark Run",
      color: colors.info,
      icon: figures.arrowRight,
      shortcut: "b",
    });
  }

  // Handle operation selection
  const handleOperation = async (operation: string, resource: ScenarioRun) => {
    switch (operation) {
      case "view-benchmark-run":
        if (resource.benchmark_run_id) {
          navigate("benchmark-run-detail", {
            benchmarkRunId: resource.benchmark_run_id,
          });
        }
        break;
    }
  };

  // Build detailed info lines for full details view
  const buildDetailLines = (r: ScenarioRun): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        Scenario Run Details
      </Text>,
    );
    lines.push(
      <Text key="core-id" color={colors.idColor}>
        {" "}
        ID: {r.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {r.name || "(none)"}
      </Text>,
    );
    lines.push(
      <Text key="core-status" dimColor>
        {" "}
        Status: {r.state}
      </Text>,
    );
    lines.push(
      <Text key="core-scenario" color={colors.idColor}>
        {" "}
        Scenario ID: {r.scenario_id}
      </Text>,
    );
    if (r.benchmark_run_id) {
      lines.push(
        <Text key="core-benchmark-run" color={colors.idColor}>
          {" "}
          Benchmark Run ID: {r.benchmark_run_id}
        </Text>,
      );
    }
    if (r.start_time_ms) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Started: {new Date(r.start_time_ms).toLocaleString()}
        </Text>,
      );
    }
    const detailEndTimeMs =
      r.start_time_ms && r.duration_ms
        ? r.start_time_ms + r.duration_ms
        : undefined;
    if (detailEndTimeMs) {
      lines.push(
        <Text key="core-ended" dimColor>
          {" "}
          Ended: {new Date(detailEndTimeMs).toLocaleString()}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Results
    const detailScore = r.scoring_contract_result?.score;
    if (detailScore !== undefined) {
      lines.push(
        <Text key="results-title" color={colors.warning} bold>
          Results
        </Text>,
      );
      lines.push(
        <Text key="results-score" dimColor>
          {" "}
          Score: {detailScore}
        </Text>,
      );
      lines.push(<Text key="results-space"> </Text>);
    }

    // Metadata
    if (r.metadata && Object.keys(r.metadata).length > 0) {
      lines.push(
        <Text key="meta-title" color={colors.warning} bold>
          Metadata
        </Text>,
      );
      Object.entries(r.metadata).forEach(([key, value], idx) => {
        lines.push(
          <Text key={`meta-${idx}`} dimColor>
            {" "}
            {key}: {value}
          </Text>,
        );
      });
      lines.push(<Text key="meta-space"> </Text>);
    }

    // Raw JSON
    lines.push(
      <Text key="json-title" color={colors.warning} bold>
        Raw JSON
      </Text>,
    );
    const jsonLines = JSON.stringify(r, null, 2).split("\n");
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

  // Check if run is still in progress for polling
  const isRunning = run.state === "running" || run.state === "scoring";

  // Build breadcrumb prefix
  const breadcrumbPrefix = [{ label: "Home" }, { label: "Benchmarks" }];
  if (benchmarkRunId) {
    breadcrumbPrefix.push({
      label: `Run: ${benchmarkRunId.substring(0, 8)}...`,
    });
  }
  breadcrumbPrefix.push({ label: "Scenario Runs" });

  return (
    <ResourceDetailPage
      resource={run}
      resourceType="Scenario Runs"
      getDisplayName={(r) => r.name || r.id}
      getId={(r) => r.id}
      getStatus={(r) => r.state}
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
      pollResource={isRunning ? pollRun : undefined}
      onPollUpdate={setFetchedRun}
      breadcrumbPrefix={breadcrumbPrefix}
    />
  );
}

/**
 * BenchmarkRunDetailScreen - Detail page for benchmark runs
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import {
  useBenchmarkStore,
  type BenchmarkRun,
} from "../store/benchmarkStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import { getBenchmarkRun } from "../services/benchmarkService.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { colors } from "../utils/theme.js";

interface BenchmarkRunDetailScreenProps {
  benchmarkRunId?: string;
}

export function BenchmarkRunDetailScreen({
  benchmarkRunId,
}: BenchmarkRunDetailScreenProps) {
  const { goBack, navigate } = useNavigation();
  const benchmarkRuns = useBenchmarkStore((state) => state.benchmarkRuns);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [fetchedRun, setFetchedRun] = React.useState<BenchmarkRun | null>(null);

  // Find run in store first
  const runFromStore = benchmarkRuns.find((r) => r.id === benchmarkRunId);

  // Polling function
  const pollRun = React.useCallback(async () => {
    if (!benchmarkRunId) return null as unknown as BenchmarkRun;
    return getBenchmarkRun(benchmarkRunId);
  }, [benchmarkRunId]);

  // Fetch run from API if not in store
  React.useEffect(() => {
    if (benchmarkRunId && !loading && !fetchedRun) {
      setLoading(true);
      setError(null);

      getBenchmarkRun(benchmarkRunId)
        .then((run) => {
          setFetchedRun(run);
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [benchmarkRunId, loading, fetchedRun]);

  // Use fetched run for full details, fall back to store for basic display
  const run = fetchedRun || runFromStore;

  // Show loading state
  if (!run && benchmarkRunId && !error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmarks" },
            { label: "Benchmark Runs" },
            { label: "Loading...", active: true },
          ]}
        />
        <SpinnerComponent message="Loading benchmark run details..." />
      </>
    );
  }

  // Show error state
  if (error && !run) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmarks" },
            { label: "Benchmark Runs" },
            { label: "Error", active: true },
          ]}
        />
        <ErrorMessage
          message="Failed to load benchmark run details"
          error={error}
        />
      </>
    );
  }

  // Show not found error
  if (!run) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmarks" },
            { label: "Benchmark Runs" },
            { label: "Not Found", active: true },
          ]}
        />
        <ErrorMessage
          message={`Benchmark run ${benchmarkRunId || "unknown"} not found`}
          error={new Error("Benchmark run not found")}
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
  if (run.benchmark_id) {
    basicFields.push({
      label: "Benchmark ID",
      value: <Text color={colors.idColor}>{run.benchmark_id}</Text>,
    });
  }
  if (run.purpose) {
    basicFields.push({
      label: "Purpose",
      value: run.purpose,
    });
  }
  if (run.score !== undefined && run.score !== null) {
    basicFields.push({
      label: "Score",
      value: (
        <Text color={colors.success} bold>
          {run.score.toFixed(2)}
        </Text>
      ),
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

  // Timing section
  const timingFields = [];
  if (run.start_time_ms) {
    timingFields.push({
      label: "Started",
      value: formatTimestamp(run.start_time_ms),
    });
  }
  const endTimeMs =
    run.start_time_ms && run.duration_ms
      ? run.start_time_ms + run.duration_ms
      : undefined;
  if (endTimeMs) {
    timingFields.push({
      label: "Ended",
      value: formatTimestamp(endTimeMs),
    });
  }
  if (run.duration_ms) {
    timingFields.push({
      label: "Duration",
      value: <Text color={colors.info}>{formatDuration(run.duration_ms)}</Text>,
    });
  }

  if (timingFields.length > 0) {
    detailSections.push({
      title: "Timing",
      icon: figures.play,
      color: colors.info,
      fields: timingFields,
    });
  }

  // Environment Variables section
  if (
    run.environment_variables &&
    Object.keys(run.environment_variables).length > 0
  ) {
    const envFields = Object.entries(run.environment_variables).map(
      ([key, value]) => ({
        label: key,
        value: <Text color={colors.secondary}>{value}</Text>,
      }),
    );

    detailSections.push({
      title: "Environment Variables",
      icon: figures.info,
      color: colors.success,
      fields: envFields,
    });
  }

  // Secrets Provided section (show keys only, not values)
  if (run.secrets_provided && Object.keys(run.secrets_provided).length > 0) {
    const secretFields = Object.entries(run.secrets_provided).map(
      ([envVar, secretName]) => ({
        label: envVar,
        value: <Text color={colors.warning}>{secretName} (secret)</Text>,
      }),
    );

    detailSections.push({
      title: "Secrets Provided",
      icon: figures.warning,
      color: colors.warning,
      fields: secretFields,
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

  // Operations available for benchmark runs
  const operations: ResourceOperation[] = [
    {
      key: "view-scenarios",
      label: "View Scenario Runs",
      color: colors.info,
      icon: figures.arrowRight,
      shortcut: "s",
    },
  ];

  // Handle operation selection
  const handleOperation = async (operation: string, resource: BenchmarkRun) => {
    switch (operation) {
      case "view-scenarios":
        navigate("scenario-run-list", { benchmarkRunId: resource.id });
        break;
    }
  };

  // Build detailed info lines for full details view
  const buildDetailLines = (r: BenchmarkRun): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        Benchmark Run Details
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
    if (r.benchmark_id) {
      lines.push(
        <Text key="core-benchmark" color={colors.idColor}>
          {" "}
          Benchmark ID: {r.benchmark_id}
        </Text>,
      );
    }
    if (r.purpose) {
      lines.push(
        <Text key="core-purpose" dimColor>
          {" "}
          Purpose: {r.purpose}
        </Text>,
      );
    }
    if (r.score !== undefined && r.score !== null) {
      lines.push(
        <Text key="core-score" color={colors.success}>
          {" "}
          Score: {r.score.toFixed(2)}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Timing
    lines.push(
      <Text key="timing-title" color={colors.info} bold>
        Timing
      </Text>,
    );
    if (r.start_time_ms) {
      lines.push(
        <Text key="timing-started" dimColor>
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
        <Text key="timing-ended" dimColor>
          {" "}
          Ended: {new Date(detailEndTimeMs).toLocaleString()}
        </Text>,
      );
    }
    if (r.duration_ms) {
      lines.push(
        <Text key="timing-duration" dimColor>
          {" "}
          Duration: {formatDuration(r.duration_ms)}
        </Text>,
      );
    }
    lines.push(<Text key="timing-space"> </Text>);

    // Environment Variables
    if (
      r.environment_variables &&
      Object.keys(r.environment_variables).length > 0
    ) {
      lines.push(
        <Text key="env-title" color={colors.success} bold>
          Environment Variables
        </Text>,
      );
      Object.entries(r.environment_variables).forEach(([key, value], idx) => {
        lines.push(
          <Text key={`env-${idx}`} dimColor>
            {" "}
            {key}: {value}
          </Text>,
        );
      });
      lines.push(<Text key="env-space"> </Text>);
    }

    // Secrets Provided
    if (r.secrets_provided && Object.keys(r.secrets_provided).length > 0) {
      lines.push(
        <Text key="secrets-title" color={colors.warning} bold>
          Secrets Provided
        </Text>,
      );
      Object.entries(r.secrets_provided).forEach(
        ([envVar, secretName], idx) => {
          lines.push(
            <Text key={`secret-${idx}`} dimColor>
              {" "}
              {envVar} → {secretName}
            </Text>,
          );
        },
      );
      lines.push(<Text key="secrets-space"> </Text>);
    }

    // Metadata
    if (r.metadata && Object.keys(r.metadata).length > 0) {
      lines.push(
        <Text key="meta-title" color={colors.secondary} bold>
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
  const isRunning = run.state === "running";

  return (
    <ResourceDetailPage
      resource={run}
      resourceType="Benchmark Runs"
      getDisplayName={(r) => r.name || r.id}
      getId={(r) => r.id}
      getStatus={(r) => r.state}
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
      pollResource={isRunning ? pollRun : undefined}
      breadcrumbPrefix={[{ label: "Home" }, { label: "Benchmarks" }]}
    />
  );
}

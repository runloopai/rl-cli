/**
 * BenchmarkDetailScreen - Detail page for benchmark definitions
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import { useBenchmarkStore, type Benchmark } from "../store/benchmarkStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import { getBenchmark } from "../services/benchmarkService.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { colors } from "../utils/theme.js";

interface BenchmarkDetailScreenProps {
  benchmarkId?: string;
}

export function BenchmarkDetailScreen({
  benchmarkId,
}: BenchmarkDetailScreenProps) {
  const { goBack, navigate } = useNavigation();
  const benchmarks = useBenchmarkStore((state) => state.benchmarks);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [fetchedBenchmark, setFetchedBenchmark] =
    React.useState<Benchmark | null>(null);

  // Find benchmark in store first
  const benchmarkFromStore = benchmarks.find((b) => b.id === benchmarkId);

  // Polling function
  const pollBenchmark = React.useCallback(async () => {
    if (!benchmarkId) return null as unknown as Benchmark;
    return getBenchmark(benchmarkId);
  }, [benchmarkId]);

  // Fetch benchmark from API once per mount
  const hasFetched = React.useRef(false);
  React.useEffect(() => {
    if (benchmarkId && !hasFetched.current && !benchmarkFromStore) {
      hasFetched.current = true;
      setLoading(true);
      setError(null);

      getBenchmark(benchmarkId)
        .then((benchmark) => {
          setFetchedBenchmark(benchmark);
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [benchmarkId, benchmarkFromStore]);

  // Use fetched benchmark for full details, fall back to store for basic display
  const benchmark = fetchedBenchmark || benchmarkFromStore;

  // Show loading state
  if (!benchmark && benchmarkId && !error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmarks" },
            { label: "Benchmark Definitions" },
            { label: "Loading...", active: true },
          ]}
        />
        <SpinnerComponent message="Loading benchmark details..." />
      </>
    );
  }

  // Show error state
  if (error && !benchmark) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmarks" },
            { label: "Benchmark Definitions" },
            { label: "Error", active: true },
          ]}
        />
        <ErrorMessage
          message="Failed to load benchmark details"
          error={error}
        />
      </>
    );
  }

  // Show not found error
  if (!benchmark) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Home" },
            { label: "Benchmarks" },
            { label: "Benchmark Definitions" },
            { label: "Not Found", active: true },
          ]}
        />
        <ErrorMessage
          message={`Benchmark ${benchmarkId || "unknown"} not found`}
          error={new Error("Benchmark not found")}
        />
      </>
    );
  }

  // Build detail sections
  const detailSections: DetailSection[] = [];

  // Basic details section
  const basicFields = [];

  if ((benchmark as any).created_at) {
    basicFields.push({
      label: "Created",
      value: formatTimestamp((benchmark as any).created_at),
    });
  }

  if ((benchmark as any).description) {
    basicFields.push({
      label: "Description",
      value: (benchmark as any).description,
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

  // Metadata section
  if (
    (benchmark as any).metadata &&
    Object.keys((benchmark as any).metadata).length > 0
  ) {
    const metadataFields = Object.entries((benchmark as any).metadata).map(
      ([key, value]) => ({
        label: key,
        value: value as string,
      }),
    );

    detailSections.push({
      title: "Metadata",
      icon: figures.identical,
      color: colors.secondary,
      fields: metadataFields,
    });
  }

  // Operations available for benchmarks
  const operations: ResourceOperation[] = [
    {
      key: "create-job",
      label: "Create Benchmark Job",
      color: colors.success,
      icon: figures.play,
      shortcut: "c",
    },
  ];

  // Handle operation selection
  const handleOperation = async (operation: string, resource: Benchmark) => {
    switch (operation) {
      case "create-job":
        navigate("benchmark-job-create", { initialBenchmarkIds: resource.id });
        break;
    }
  };

  // Build detailed info lines for full details view
  const buildDetailLines = (b: Benchmark): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        Benchmark Details
      </Text>,
    );
    lines.push(
      <Text key="core-id" color={colors.idColor}>
        {" "}
        ID: {b.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {b.name || "(none)"}
      </Text>,
    );
    if ((b as any).description) {
      lines.push(
        <Text key="core-desc" dimColor>
          {" "}
          Description: {(b as any).description}
        </Text>,
      );
    }
    if ((b as any).created_at) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Created: {new Date((b as any).created_at).toLocaleString()}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Metadata
    if ((b as any).metadata && Object.keys((b as any).metadata).length > 0) {
      lines.push(
        <Text key="meta-title" color={colors.warning} bold>
          Metadata
        </Text>,
      );
      Object.entries((b as any).metadata).forEach(([key, value], idx) => {
        lines.push(
          <Text key={`meta-${idx}`} dimColor>
            {" "}
            {key}: {value as string}
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
    const jsonLines = JSON.stringify(b, null, 2).split("\n");
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

  return (
    <ResourceDetailPage
      resource={benchmark}
      resourceType="Benchmark Definitions"
      getDisplayName={(b) => b.name || b.id}
      getId={(b) => b.id}
      getStatus={(b) => (b as any).status}
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
      breadcrumbPrefix={[{ label: "Home" }, { label: "Benchmarks" }]}
    />
  );
}

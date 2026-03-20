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
  type DetailField,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import {
  getBenchmark,
  listAllBenchmarkScenarioDefinitions,
} from "../services/benchmarkService.js";
import type { Scenario } from "../services/scenarioService.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { colors } from "../utils/theme.js";

interface BenchmarkDetailScreenProps {
  benchmarkId?: string;
}

function getScenarioIdsFromBenchmark(b: Benchmark): string[] {
  if (Array.isArray(b.scenarioIds) && b.scenarioIds.length > 0) {
    return b.scenarioIds;
  }
  const raw = b as { scenario_ids?: string[] };
  if (Array.isArray(raw.scenario_ids) && raw.scenario_ids.length > 0) {
    return raw.scenario_ids;
  }
  return [];
}

function getOrderedScenarioIds(b: Benchmark, defs: Scenario[]): string[] {
  const fromBench = getScenarioIdsFromBenchmark(b);
  if (fromBench.length > 0) return fromBench;
  return defs.map((s) => s.id);
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

  const [scenarioDefs, setScenarioDefs] = React.useState<Scenario[]>([]);
  const [scenarioDefsLoading, setScenarioDefsLoading] = React.useState(false);
  const [scenarioDefsError, setScenarioDefsError] =
    React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!benchmarkId) return;
    let cancelled = false;
    setScenarioDefs([]);
    setScenarioDefsLoading(true);
    setScenarioDefsError(null);
    listAllBenchmarkScenarioDefinitions(benchmarkId)
      .then((scenarios) => {
        if (!cancelled) {
          setScenarioDefs(scenarios);
          setScenarioDefsLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setScenarioDefsError(e as Error);
          setScenarioDefs([]);
          setScenarioDefsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [benchmarkId]);

  const detailSections = React.useMemo((): DetailSection[] => {
    const b = benchmark;
    if (!b) return [];

    const sections: DetailSection[] = [];

    const basicFields = [];

    if ((b as any).created_at) {
      basicFields.push({
        label: "Created",
        value: formatTimestamp((b as any).created_at),
      });
    }

    if ((b as any).description) {
      basicFields.push({
        label: "Description",
        value: (b as any).description,
      });
    }

    if (basicFields.length > 0) {
      sections.push({
        title: "Details",
        icon: figures.squareSmallFilled,
        color: colors.warning,
        fields: basicFields,
      });
    }

    if ((b as any).metadata && Object.keys((b as any).metadata).length > 0) {
      const metadataFields = Object.entries((b as any).metadata).map(
        ([key, value]) => ({
          label: key,
          value: value as string,
        }),
      );

      sections.push({
        title: "Metadata",
        icon: figures.identical,
        color: colors.secondary,
        fields: metadataFields,
      });
    }

    const orderedScenarioIds = getOrderedScenarioIds(b, scenarioDefs);
    if (orderedScenarioIds.length === 0) {
      return sections;
    }

    sections.push({
      title: "Scenarios",
      icon: figures.circleFilled,
      color: colors.info,
      sectionViewShortcut: "s",
      fields: [
        {
          label: "Count",
          value: String(orderedScenarioIds.length),
        },
        ...orderedScenarioIds.map((id) => ({
          label: "",
          value: (
            <Text dimColor>
              {figures.pointer} {id}
            </Text>
          ),
        })),
      ],
    });

    const nameFields: DetailField[] = [
      {
        label: "Count",
        value: String(orderedScenarioIds.length),
      },
    ];

    if (scenarioDefsLoading) {
      nameFields.push({
        label: "",
        value: <Text dimColor>Loading scenario names…</Text>,
      });
    } else if (scenarioDefsError) {
      nameFields.push({
        label: "",
        value: <Text color={colors.error}>{scenarioDefsError.message}</Text>,
      });
    } else {
      const idToName = new Map(scenarioDefs.map((s) => [s.id, s.name || s.id]));
      for (const id of orderedScenarioIds) {
        const name = idToName.get(id) ?? id;
        nameFields.push({
          label: "",
          value: (
            <Text dimColor>
              {figures.pointer} {name}
            </Text>
          ),
        });
      }
    }

    sections.push({
      title: "Scenario names",
      icon: figures.pointer,
      color: colors.success,
      sectionViewShortcut: "n",
      fields: nameFields,
    });

    return sections;
  }, [benchmark, scenarioDefs, scenarioDefsLoading, scenarioDefsError]);

  const buildDetailLines = React.useCallback(
    (b: Benchmark): React.ReactElement[] => {
      const lines: React.ReactElement[] = [];

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

      const orderedScenarioIds = getOrderedScenarioIds(b, scenarioDefs);
      if (orderedScenarioIds.length > 0) {
        lines.push(
          <Text key="scen-title" color={colors.warning} bold>
            Scenarios
          </Text>,
        );
        lines.push(
          <Text key="scen-count" dimColor>
            {" "}
            Count: {orderedScenarioIds.length}
          </Text>,
        );
        orderedScenarioIds.forEach((id, idx) => {
          lines.push(
            <Text key={`scen-id-${idx}`} dimColor>
              {" "}
              {figures.pointer} {id}
            </Text>,
          );
        });
        lines.push(<Text key="scen-space"> </Text>);

        lines.push(
          <Text key="scen-names-title" color={colors.warning} bold>
            Scenario names
          </Text>,
        );
        lines.push(
          <Text key="scen-names-count" dimColor>
            {" "}
            Count: {orderedScenarioIds.length}
          </Text>,
        );
        if (scenarioDefsLoading) {
          lines.push(
            <Text key="scen-names-load" dimColor>
              {" "}
              Loading scenario names…
            </Text>,
          );
        } else if (scenarioDefsError) {
          lines.push(
            <Text key="scen-names-err" color={colors.error}>
              {" "}
              {scenarioDefsError.message}
            </Text>,
          );
        } else {
          const idToName = new Map(
            scenarioDefs.map((s) => [s.id, s.name || s.id]),
          );
          orderedScenarioIds.forEach((id, idx) => {
            lines.push(
              <Text key={`scen-name-${idx}`} dimColor>
                {" "}
                {figures.pointer} {idToName.get(id) ?? id}
              </Text>,
            );
          });
        }
        lines.push(<Text key="scen-names-space"> </Text>);
      }

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
    },
    [scenarioDefs, scenarioDefsLoading, scenarioDefsError],
  );

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

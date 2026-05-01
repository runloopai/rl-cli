import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import {
  executeAxonSql,
  getAxon,
  type SqlQueryResultView,
} from "../services/axonService.js";
import { Table, createTextColumn } from "../components/Table.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { NavigationTips } from "../components/NavigationTips.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

interface AxonSqlScreenProps {
  axonId?: string;
}

type ScreenState = "input" | "executing" | "results" | "error";

const DEFAULT_QUERY =
  "SELECT sequence, timestamp_ms, source, event_type, origin, payload FROM rl_axon_events LIMIT 5;";

export function AxonSqlScreen({ axonId }: AxonSqlScreenProps) {
  const { goBack, params } = useNavigation();
  const id = axonId || (params.axonId as string);

  const [screenState, setScreenState] = React.useState<ScreenState>("input");
  const [query, setQuery] = React.useState(DEFAULT_QUERY);
  const [result, setResult] = React.useState<SqlQueryResultView | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [axonName, setAxonName] = React.useState("");
  const [executedQuery, setExecutedQuery] = React.useState("");

  useExitOnCtrlC();

  // Fetch axon name on mount
  React.useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const fetchAxonName = async () => {
      try {
        const axon = await getAxon(id);
        if (!cancelled) {
          setAxonName(axon.name || id);
        }
      } catch {
        // Silently fail, fallback to ID
        if (!cancelled) {
          setAxonName(id);
        }
      }
    };

    fetchAxonName();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const executeQuery = React.useCallback(async () => {
    if (!id || !query.trim()) return;

    setScreenState("executing");
    setExecutedQuery(query);

    try {
      const queryResult = await executeAxonSql(id, query);
      setResult(queryResult);
      setError(null);
      setScreenState("results");
    } catch (err) {
      setError(err as Error);
      setResult(null);
      setScreenState("error");
    }
  }, [id, query]);

  useInput((input, key) => {
    if (screenState === "input") {
      if (key.escape) {
        goBack();
      } else if (key.return) {
        executeQuery();
      }
    } else if (screenState === "results") {
      if (key.escape || input === "q") {
        goBack();
      } else if (input === "e") {
        setScreenState("input");
      } else if (input === "r") {
        executeQuery();
      }
    } else if (screenState === "error") {
      if (key.escape || input === "q") {
        goBack();
      } else if (input === "e") {
        setScreenState("input");
      } else if (input === "r") {
        executeQuery();
      }
    }
  });

  React.useEffect(() => {
    if (!id) {
      goBack();
    }
  }, [id, goBack]);

  if (!id) {
    return null;
  }

  const breadcrumbItems = [
    { label: "Axons" },
    { label: axonName || id },
    { label: "SQL Workbench", active: true },
  ];

  // Input mode
  if (screenState === "input") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <Box flexDirection="column" paddingX={1} paddingY={1}>
          <Box marginBottom={1}>
            <Text color={colors.primary} bold>
              {figures.pointer} SQL Workbench
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color={colors.info}>SQL Query:</Text>
          </Box>

          <Box marginBottom={1} paddingLeft={1}>
            <TextInput
              value={query}
              onChange={setQuery}
              placeholder="Enter SQL query..."
              onSubmit={executeQuery}
            />
          </Box>

          <Box marginTop={1}>
            <Text color={colors.textDim} dimColor>
              Press [Enter] to execute or [Esc] to go back
            </Text>
          </Box>
        </Box>

        <NavigationTips
          tips={[
            { key: "Enter", label: "Execute query" },
            { key: "Esc", label: "Back" },
          ]}
        />
      </>
    );
  }

  // Executing mode
  if (screenState === "executing") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <SpinnerComponent message="Executing query..." />
      </>
    );
  }

  // Error mode
  if (screenState === "error") {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <Box flexDirection="column" paddingX={1} paddingY={1}>
          <Box marginBottom={1}>
            <Text color={colors.primary} bold>
              {figures.cross} Query Failed
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color={colors.textDim} dimColor>
              Query: {executedQuery}
            </Text>
          </Box>

          <ErrorMessage
            message="Failed to execute SQL query"
            error={error ?? undefined}
          />

          <Box marginTop={1}>
            <Text color={colors.textDim} dimColor>
              Press [e] to edit query, [r] to retry, or [q] to go back
            </Text>
          </Box>
        </Box>

        <NavigationTips
          tips={[
            { key: "e", label: "Edit query" },
            { key: "r", label: "Retry" },
            { key: "q/Esc", label: "Back" },
          ]}
        />
      </>
    );
  }

  // Results mode
  if (screenState === "results" && result) {
    const normalizedRows = result.rows.map((row, rowIndex) => {
      const obj: Record<string, unknown> = Array.isArray(row)
        ? Object.fromEntries(
            result.columns.map((col, i) => [col.name, (row as unknown[])[i]]),
          )
        : { ...(row as Record<string, unknown>) };
      obj.__rowIndex = rowIndex;
      return obj;
    });

    // Build dynamic columns from result.columns
    const tableColumns = result.columns.map((col) =>
      createTextColumn<Record<string, unknown>>(
        col.name,
        col.name + (col.type ? ` (${col.type})` : ""),
        (row) => {
          const val = row[col.name];
          if (val === null || val === undefined) return "NULL";
          return String(val);
        },
        { width: Math.max(col.name.length + (col.type?.length ?? 0) + 4, 15) },
      ),
    );

    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <Box flexDirection="column" paddingX={1} paddingY={1}>
          <Box marginBottom={1}>
            <Text color={colors.primary} bold>
              {figures.tick} Query Results
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color={colors.textDim} dimColor>
              Query: {executedQuery}
            </Text>
          </Box>

          <Box marginBottom={1}>
            <Text color={colors.info}>
              {figures.info} {result.meta.duration_ms}ms
            </Text>
            <Text color={colors.textDim} dimColor>
              {" "}
              • {normalizedRows.length} rows
            </Text>
            {result.meta.changes > 0 && (
              <Text color={colors.warning}>
                {" "}
                • {result.meta.changes} changes
              </Text>
            )}
            {result.meta.rows_read_limit_reached && (
              <Text color={colors.warning}>
                {" "}
                • Results truncated (limit reached)
              </Text>
            )}
          </Box>

          <Table
            data={normalizedRows}
            columns={tableColumns}
            selectedIndex={-1}
            showSelection={false}
            keyExtractor={(row) => String(row.__rowIndex)}
            emptyState={
              <Text color={colors.textDim} dimColor>
                {figures.info} No results
              </Text>
            }
          />
        </Box>

        <NavigationTips
          tips={[
            { key: "e", label: "Edit query" },
            { key: "r", label: "Re-run" },
            { key: "q/Esc", label: "Back" },
          ]}
        />
      </>
    );
  }

  return null;
}

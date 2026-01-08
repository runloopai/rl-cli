/**
 * BlueprintLogsScreen - Screen for viewing blueprint build logs
 */
import React from "react";
import { Box, Text } from "ink";
import { useNavigation } from "../store/navigationStore.js";
import { LogsViewer } from "../components/LogsViewer.js";
import { Header } from "../components/Header.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { getBlueprintLogs } from "../services/blueprintService.js";
import { colors } from "../utils/theme.js";

interface BlueprintLogsScreenProps {
  blueprintId?: string;
}

export function BlueprintLogsScreen({ blueprintId }: BlueprintLogsScreenProps) {
  const { goBack, params } = useNavigation();
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  // Use blueprintId from props or params
  const id = blueprintId || (params.blueprintId as string);

  React.useEffect(() => {
    if (!id) {
      goBack();
      return;
    }

    let cancelled = false;

    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const blueprintLogs = await getBlueprintLogs(id);
        if (!cancelled) {
          setLogs(Array.isArray(blueprintLogs) ? blueprintLogs : []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    fetchLogs();

    return () => {
      cancelled = true;
    };
  }, [id, goBack]);

  if (!id) {
    return null;
  }

  // Get blueprint name from params if available (for breadcrumb)
  const blueprintName = (params.blueprintName as string) || id;

  if (loading) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Blueprints" },
            { label: blueprintName },
            { label: "Logs", active: true },
          ]}
        />
        <Header title="Loading Logs" />
        <SpinnerComponent message="Fetching blueprint logs..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Blueprints" },
            { label: blueprintName },
            { label: "Logs", active: true },
          ]}
        />
        <Header title="Error" />
        <ErrorMessage message="Failed to load blueprint logs" error={error} />
        <Box marginTop={1} paddingX={1}>
          <Text color={colors.textDim} dimColor>
            Press [q] or [esc] to go back
          </Text>
        </Box>
      </>
    );
  }

  return (
    <LogsViewer
      logs={logs}
      breadcrumbItems={[
        { label: "Blueprints" },
        { label: blueprintName },
        { label: "Logs", active: true },
      ]}
      onBack={goBack}
      title="Blueprint Build Logs"
    />
  );
}

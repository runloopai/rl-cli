import React from "react";
import { Box, Text } from "ink";
import { getClient } from "../../utils/client.js";
import { Header } from "../../components/Header.js";
import { Banner } from "../../components/Banner.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { SuccessMessage } from "../../components/SuccessMessage.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { createExecutor } from "../../utils/CommandExecutor.js";
import { colors } from "../../utils/theme.js";

interface BlueprintLogsOptions {
  id: string;
  output?: string;
}

const BlueprintLogsUI = ({ blueprintId }: { blueprintId: string }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const getLogs = async () => {
      try {
        const client = getClient();
        const logs = await client.blueprints.logs(blueprintId);
        setResult(logs);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    getLogs();
  }, [blueprintId]);

  return (
    <>
      <Banner />
      {loading && (
        <SpinnerComponent message="Fetching blueprint build logs..." />
      )}
      {result && (
        <Box flexDirection="column">
          <Text color={colors.primary}>Blueprint Build Logs:</Text>
          {result.logs && result.logs.length > 0 ? (
            result.logs.map((log: any, index: number) => (
              <Box key={index} marginLeft={2}>
                <Text color={colors.textDim}>
                  {log.timestampMs
                    ? new Date(log.timestampMs).toISOString()
                    : ""}
                </Text>
                <Text color={colors.textDim}> [{log.level}]</Text>
                <Text> {log.message}</Text>
              </Box>
            ))
          ) : (
            <Text color={colors.textDim}>No logs available</Text>
          )}
        </Box>
      )}
      {error && (
        <ErrorMessage message="Failed to get blueprint logs" error={error} />
      )}
    </>
  );
};

export async function getBlueprintLogs(options: BlueprintLogsOptions) {
  const executor = createExecutor({ output: options.output });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.blueprints.logs(options.id);
    },
    () => <BlueprintLogsUI blueprintId={options.id} />,
  );
}

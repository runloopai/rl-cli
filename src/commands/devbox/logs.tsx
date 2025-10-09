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

interface LogsOptions {
  output?: string;
}

const LogsUI: React.FC<{
  devboxId: string;
}> = ({ devboxId }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const getLogs = async () => {
      try {
        const client = getClient();
        const logs = await client.devboxes.logs.list(devboxId);
        setResult(logs);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    getLogs();
  }, [devboxId]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Fetching devbox logs..." />}
      {result && (
        <Box flexDirection="column">
          <Text color={colors.primary}>Devbox Logs:</Text>
          {result.logs && result.logs.length > 0 ? (
            result.logs.map((log: any, index: number) => (
              <Box key={index} marginLeft={2}>
                <Text color={colors.textDim}>
                  {log.timestampMs ? new Date(log.timestampMs).toISOString() : ""}
                </Text>
                {log.source && <Text color={colors.textDim}> [{log.source}]</Text>}
                {log.cmd && <Text color={colors.primary}> {"->"} {log.cmd}</Text>}
                {log.message && <Text> {log.message}</Text>}
                {log.exitCode !== null && <Text color={colors.warning}> {"->"} exit_code={log.exitCode}</Text>}
              </Box>
            ))
          ) : (
            <Text color={colors.textDim}>No logs available</Text>
          )}
        </Box>
      )}
      {error && (
        <ErrorMessage message="Failed to get devbox logs" error={error} />
      )}
    </>
  );
};

export async function getLogs(devboxId: string, options: LogsOptions) {
  const executor = createExecutor({ output: options.output });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.devboxes.logs.list(devboxId);
    },
    () => <LogsUI devboxId={devboxId} />,
  );
}

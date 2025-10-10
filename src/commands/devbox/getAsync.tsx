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

interface GetAsyncOptions {
  executionId: string;
  output?: string;
}

const GetAsyncUI: React.FC<{
  devboxId: string;
  executionId: string;
}> = ({ devboxId, executionId }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const getAsync = async () => {
      try {
        const client = getClient();
        const execution = await client.devboxes.executions.retrieve(
          executionId,
          devboxId,
        );
        setResult(execution);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    getAsync();
  }, [devboxId, executionId]);

  return (
    <>
      <Banner />
      {loading && (
        <SpinnerComponent message="Getting async execution status..." />
      )}
      {result && (
        <SuccessMessage
          message="Async execution status retrieved"
          details={`Execution ID: ${result.id}\nStatus: ${result.status}\nCommand: ${result.command}`}
        />
      )}
      {error && (
        <ErrorMessage
          message="Failed to get async execution status"
          error={error}
        />
      )}
    </>
  );
};

export async function getAsync(devboxId: string, options: GetAsyncOptions) {
  const executor = createExecutor({ output: options.output });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.devboxes.executions.retrieve(devboxId, options.executionId);
    },
    () => <GetAsyncUI devboxId={devboxId} executionId={options.executionId} />,
  );
}

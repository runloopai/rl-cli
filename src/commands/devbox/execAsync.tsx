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

interface ExecAsyncOptions {
  command: string;
  shellName?: string;
  output?: string;
}

const ExecAsyncUI = ({
  devboxId,
  command,
  shellName,
}: {
  devboxId: string;
  command: string;
  shellName?: string;
}) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const execAsync = async () => {
      try {
        const client = getClient();
        const execution = await client.devboxes.executeAsync(devboxId, {
          command,
          shell_name: shellName || undefined,
        });
        setResult(execution);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    execAsync();
  }, [devboxId, command, shellName]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Starting async execution..." />}
      {result && (
        <SuccessMessage
          message="Async execution started"
          details={`Execution ID: ${result.id}\nCommand: ${command}\nStatus: ${result.status}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to start async execution" error={error} />
      )}
    </>
  );
};

export async function execAsync(devboxId: string, options: ExecAsyncOptions) {
  const executor = createExecutor({ output: options.output });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.devboxes.executeAsync(devboxId, {
        command: options.command,
        shell_name: options.shellName || undefined,
      });
    },
    () => (
      <ExecAsyncUI
        devboxId={devboxId}
        command={options.command}
        shellName={options.shellName}
      />
    ),
  );
}

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

interface ShutdownOptions {
  output?: string;
}

const ShutdownDevboxUI = ({ devboxId }: { devboxId: string }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const shutdownDevbox = async () => {
      try {
        const client = getClient();
        const devbox = await client.devboxes.shutdown(devboxId);
        setResult(devbox);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    shutdownDevbox();
  }, [devboxId]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Shutting down devbox..." />}
      {result && (
        <SuccessMessage
          message="Devbox shutdown"
          details={`ID: ${result.id}\nStatus: ${result.status}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to shutdown devbox" error={error} />
      )}
    </>
  );
};

export async function shutdownDevbox(
  devboxId: string,
  options: ShutdownOptions,
) {
  const executor = createExecutor(options);

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.devboxes.shutdown(devboxId);
    },
    () => <ShutdownDevboxUI devboxId={devboxId} />,
  );
}

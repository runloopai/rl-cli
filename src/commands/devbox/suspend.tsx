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

interface SuspendOptions {
  output?: string;
}

const SuspendDevboxUI = ({ devboxId }: { devboxId: string }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const suspendDevbox = async () => {
      try {
        const client = getClient();
        const devbox = await client.devboxes.suspend(devboxId);
        setResult(devbox);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    suspendDevbox();
  }, [devboxId]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Suspending devbox..." />}
      {result && (
        <SuccessMessage
          message="Devbox suspended"
          details={`ID: ${result.id}\nStatus: ${result.status}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to suspend devbox" error={error} />
      )}
    </>
  );
};

export async function suspendDevbox(devboxId: string, options: SuspendOptions) {
  const executor = createExecutor(options);

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.devboxes.suspend(devboxId);
    },
    () => <SuspendDevboxUI devboxId={devboxId} />,
  );
}

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

interface ResumeOptions {
  output?: string;
}

const ResumeDevboxUI: React.FC<{
  devboxId: string;
}> = ({ devboxId }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const resumeDevbox = async () => {
      try {
        const client = getClient();
        const devbox = await client.devboxes.resume(devboxId);
        setResult(devbox);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    resumeDevbox();
  }, [devboxId]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Resuming devbox..." />}
      {result && (
        <SuccessMessage
          message="Devbox resumed"
          details={`ID: ${result.id}\nStatus: ${result.status}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to resume devbox" error={error} />
      )}
    </>
  );
};

export async function resumeDevbox(devboxId: string, options: ResumeOptions) {
  const executor = createExecutor(options);

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.devboxes.resume(devboxId);
    },
    () => <ResumeDevboxUI devboxId={devboxId} />,
  );
}

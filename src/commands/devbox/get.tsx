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

interface GetOptions {
  output?: string;
}

const GetDevboxUI: React.FC<{
  devboxId: string;
}> = ({ devboxId }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const getDevbox = async () => {
      try {
        const client = getClient();
        const devbox = await client.devboxes.retrieve(devboxId);
        setResult(devbox);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    getDevbox();
  }, [devboxId]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Fetching devbox details..." />}
      {result && (
        <SuccessMessage
          message="Devbox details retrieved"
          details={`ID: ${result.id}\nStatus: ${result.status}\nCreated: ${new Date(result.createdAt).toLocaleString()}`}
        />
      )}
      {error && <ErrorMessage message="Failed to get devbox" error={error} />}
    </>
  );
};

export async function getDevbox(devboxId: string, options: GetOptions) {
  const executor = createExecutor(options);

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.devboxes.retrieve(devboxId);
    },
    () => <GetDevboxUI devboxId={devboxId} />,
  );
}

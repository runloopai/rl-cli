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

interface SnapshotStatusOptions {
  snapshotId: string;
  outputFormat?: string;
}

const SnapshotStatusUI = ({ snapshotId }: { snapshotId: string }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const getSnapshotStatus = async () => {
      try {
        const client = getClient();
        const status =
          await client.devboxes.diskSnapshots.queryStatus(snapshotId);
        setResult(status);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    getSnapshotStatus();
  }, [snapshotId]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Getting snapshot status..." />}
      {result && (
        <SuccessMessage
          message="Snapshot status retrieved"
          details={`Snapshot ID: ${result.id}\nStatus: ${result.status}\nCreated: ${new Date(result.createdAt).toLocaleString()}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to get snapshot status" error={error} />
      )}
    </>
  );
};

export async function getSnapshotStatus(options: SnapshotStatusOptions) {
  const executor = createExecutor({ output: options.outputFormat });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.devboxes.diskSnapshots.queryStatus(options.snapshotId);
    },
    () => <SnapshotStatusUI snapshotId={options.snapshotId} />,
  );
}

import React from 'react';
import { render } from 'ink';
import { getClient } from '../../utils/client.js';
import { Header } from '../../components/Header.js';
import { SpinnerComponent } from '../../components/Spinner.js';
import { SuccessMessage } from '../../components/SuccessMessage.js';
import { ErrorMessage } from '../../components/ErrorMessage.js';
import { createExecutor } from '../../utils/CommandExecutor.js';
import { OutputOptions } from '../../utils/output.js';

const DeleteSnapshotUI: React.FC<{ id: string }> = ({ id }) => {
  const [loading, setLoading] = React.useState(true);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const deleteSnapshot = async () => {
      try {
        const client = getClient();
        await client.devboxes.diskSnapshots.delete(id);
        setSuccess(true);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    deleteSnapshot();
  }, []);

  return (
    <>
      <Header title="Delete Snapshot" subtitle={`Deleting snapshot: ${id}`} />
      {loading && <SpinnerComponent message="Deleting snapshot..." />}
      {success && (
        <SuccessMessage
          message="Snapshot deleted successfully!"
          details={`ID: ${id}`}
        />
      )}
      {error && <ErrorMessage message="Failed to delete snapshot" error={error} />}
    </>
  );
};

export async function deleteSnapshot(id: string, options: OutputOptions = {}) {
  const executor = createExecutor(options);

  await executor.executeDelete(
    async () => {
      const client = executor.getClient();
      await client.devboxes.diskSnapshots.delete(id);
    },
    id,
    () => <DeleteSnapshotUI id={id} />
  );
}

import React from "react";
import { render } from "ink";
import { getClient } from "../../utils/client.js";
import { Header } from "../../components/Header.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { SuccessMessage } from "../../components/SuccessMessage.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { createExecutor } from "../../utils/CommandExecutor.js";
import { OutputOptions } from "../../utils/output.js";

const DeleteDevboxUI = ({ id }: { id: string }) => {
  const [loading, setLoading] = React.useState(true);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const deleteDevbox = async () => {
      try {
        const client = getClient();
        await client.devboxes.shutdown(id);
        setSuccess(true);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    deleteDevbox();
  }, []);

  return (
    <>
      <Header
        title="Shutdown Devbox"
        subtitle={`Shutting down devbox: ${id}`}
      />
      {loading && <SpinnerComponent message="Shutting down devbox..." />}
      {success && (
        <SuccessMessage
          message="Devbox shut down successfully!"
          details={`ID: ${id}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to shutdown devbox" error={error} />
      )}
    </>
  );
};

export async function deleteDevbox(id: string, options: OutputOptions = {}) {
  const executor = createExecutor(options);

  await executor.executeDelete(
    async () => {
      const client = executor.getClient();
      await client.devboxes.shutdown(id);
    },
    id,
    () => <DeleteDevboxUI id={id} />,
  );
}

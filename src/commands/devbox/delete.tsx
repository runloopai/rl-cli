import React from 'react';
import { render } from 'ink';
import { getClient } from '../../utils/client.js';
import { Header } from '../../components/Header.js';
import { SpinnerComponent } from '../../components/Spinner.js';
import { SuccessMessage } from '../../components/SuccessMessage.js';
import { ErrorMessage } from '../../components/ErrorMessage.js';
import { shouldUseNonInteractiveOutput, outputResult, OutputOptions } from '../../utils/output.js';

const DeleteDevboxUI: React.FC<{ id: string }> = ({ id }) => {
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
      <Header title="Delete Devbox" subtitle={`Deleting devbox: ${id}`} />
      {loading && <SpinnerComponent message="Deleting devbox..." />}
      {success && (
        <SuccessMessage
          message="Devbox deleted successfully!"
          details={`ID: ${id}`}
        />
      )}
      {error && <ErrorMessage message="Failed to delete devbox" error={error} />}
    </>
  );
};

export async function deleteDevbox(id: string, options: OutputOptions = {}) {
  // Handle non-interactive output formats
  if (shouldUseNonInteractiveOutput(options)) {
    try {
      const client = getClient();
      await client.devboxes.shutdown(id);
      outputResult({ id, status: 'deleted' }, options);
    } catch (err) {
      if (options.output === 'yaml') {
        const YAML = (await import('yaml')).default;
        console.error(YAML.stringify({ error: (err as Error).message }));
      } else {
        console.error(JSON.stringify({ error: (err as Error).message }, null, 2));
      }
      process.exit(1);
    }
    return;
  }

  // Interactive mode
  const { waitUntilExit } = render(<DeleteDevboxUI id={id} />);
  await waitUntilExit();
}

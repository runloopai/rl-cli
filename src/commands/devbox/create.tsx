import React from 'react';
import { render, Box, Text } from 'ink';
import { getClient } from '../../utils/client.js';
import { Header } from '../../components/Header.js';
import { Banner } from '../../components/Banner.js';
import { SpinnerComponent } from '../../components/Spinner.js';
import { SuccessMessage } from '../../components/SuccessMessage.js';
import { ErrorMessage } from '../../components/ErrorMessage.js';

interface CreateOptions {
  name?: string;
  template?: string;
}

const CreateDevboxUI: React.FC<{
  name?: string;
  template?: string;
}> = ({ name, template }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const create = async () => {
      try {
        const client = getClient();
        const devbox = await client.devboxes.create({
          name: name || `devbox-${Date.now()}`,
          ...(template && { template }),
        });
        setResult(devbox);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    create();
  }, []);

  return (
    <>
      <Banner />
      <Header title="Create Devbox" />
      {loading && <SpinnerComponent message="Creating..." />}
      {result && (
        <>
          <SuccessMessage
            message="Devbox created!"
            details={`ID: ${result.id}\nStatus: ${result.status}`}
          />
          <Box marginTop={1}>
            <Text color="gray">Try: </Text>
            <Text color="cyan">rln devbox exec {result.id.slice(0, 8)} ls</Text>
          </Box>
        </>
      )}
      {error && <ErrorMessage message="Failed to create devbox" error={error} />}
    </>
  );
};

export async function createDevbox(options: CreateOptions) {
  console.clear();
  const { waitUntilExit } = render(
    <CreateDevboxUI name={options.name} template={options.template} />
  );
  await waitUntilExit();
}

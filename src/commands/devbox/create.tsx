import React from 'react';
import { render, Box, Text } from 'ink';
import { getClient } from '../../utils/client.js';
import { Header } from '../../components/Header.js';
import { Banner } from '../../components/Banner.js';
import { SpinnerComponent } from '../../components/Spinner.js';
import { SuccessMessage } from '../../components/SuccessMessage.js';
import { ErrorMessage } from '../../components/ErrorMessage.js';
import { shouldUseNonInteractiveOutput, outputResult } from '../../utils/output.js';

interface CreateOptions {
  name?: string;
  template?: string;
  output?: string;
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
  // Handle non-interactive output formats
  if (shouldUseNonInteractiveOutput(options)) {
    try {
      const client = getClient();
      const devbox = await client.devboxes.create({
        name: options.name || `devbox-${Date.now()}`,
        ...(options.template && { template: options.template }),
      });
      outputResult(devbox, options);
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
  console.clear();
  const { waitUntilExit } = render(
    <CreateDevboxUI name={options.name} template={options.template} />
  );
  await waitUntilExit();
}

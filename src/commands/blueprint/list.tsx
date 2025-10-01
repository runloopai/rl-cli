import React from 'react';
import { render, Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import figures from 'figures';
import { Header } from '../../components/Header.js';

const ListBlueprintsUI: React.FC = () => {
  return (
    <>
      <Header title="Blueprints" subtitle="Coming soon!" />
      <Box
        borderStyle="round"
        borderColor="yellow"
        paddingX={3}
        paddingY={2}
        marginY={1}
        flexDirection="column"
      >
        <Box marginBottom={1}>
          <Text color="yellow" bold>
            {figures.info} Blueprint management coming soon
          </Text>
        </Box>
        <Box marginLeft={2} flexDirection="column" gap={1}>
          <Text color="gray">
            Blueprints allow you to save and reuse devbox configurations.
          </Text>
          <Box marginTop={1}>
            <Text color="gray">For now, use </Text>
            <Text color="cyan" bold>
              snapshots
            </Text>
            <Text color="gray"> to save devbox state.</Text>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export async function listBlueprints() {
  console.clear();
  const { waitUntilExit } = render(<ListBlueprintsUI />);
  await waitUntilExit();
}

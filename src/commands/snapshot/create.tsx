import React from "react";
import { render, Box, Text } from "ink";
import Gradient from "ink-gradient";
import figures from "figures";
import { getClient } from "../../utils/client.js";
import { Header } from "../../components/Header.js";
import { Banner } from "../../components/Banner.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { SuccessMessage } from "../../components/SuccessMessage.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { colors } from "../../utils/theme.js";

interface CreateOptions {
  name?: string;
}

const CreateSnapshotUI: React.FC<{
  devboxId: string;
  name?: string;
}> = ({ devboxId, name }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const create = async () => {
      try {
        const client = getClient();
        const snapshot = await client.devboxes.snapshotDisk(devboxId, {
          ...(name && { name }),
        });
        setResult(snapshot);
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
      <Header
        title="Create Snapshot"
        subtitle="Taking a snapshot of your devbox..."
      />

      {loading && (
        <>
          <SpinnerComponent message="Creating snapshot..." />
          <Box
            borderStyle="round"
            borderColor={colors.info}
            paddingX={3}
            paddingY={1}
            marginY={1}
            flexDirection="column"
          >
            <Box marginBottom={1}>
              <Text color={colors.primary} bold>
                {figures.info} Configuration
              </Text>
            </Box>
            <Box flexDirection="column" gap={1}>
              <Box>
                <Text color={colors.textDim}>
                  {figures.pointer} Devbox ID:{" "}
                </Text>
                <Text color={colors.text}>{devboxId}</Text>
              </Box>
              {name && (
                <Box>
                  <Text color={colors.textDim}>{figures.pointer} Name: </Text>
                  <Text color={colors.text}>{name}</Text>
                </Box>
              )}
            </Box>
          </Box>
        </>
      )}

      {result && (
        <>
          <SuccessMessage
            message="Snapshot created successfully!"
            details={`ID: ${result.id}\nName: ${result.name || "(unnamed)"}\nStatus: ${result.status}`}
          />
          <Box
            borderStyle="double"
            borderColor={colors.success}
            paddingX={3}
            paddingY={1}
            marginY={1}
            flexDirection="column"
          >
            <Box marginBottom={1}>
              <Gradient name="summer">
                <Text bold>{figures.star} Next Steps</Text>
              </Gradient>
            </Box>
            <Box flexDirection="column" gap={1} marginLeft={2}>
              <Box>
                <Text color={colors.textDim}>
                  {figures.tick} View snapshots:{" "}
                </Text>
                <Text color={colors.primary}>rln snapshot list</Text>
              </Box>
              <Box>
                <Text color={colors.textDim}>
                  {figures.tick} Create devbox from snapshot:{" "}
                </Text>
                <Text color={colors.primary}>
                  rln devbox create -t {result.id}
                </Text>
              </Box>
            </Box>
          </Box>
        </>
      )}

      {error && (
        <ErrorMessage message="Failed to create snapshot" error={error} />
      )}
    </>
  );
};

export async function createSnapshot(devboxId: string, options: CreateOptions) {
  console.clear();
  const { waitUntilExit } = render(
    <CreateSnapshotUI devboxId={devboxId} name={options.name} />,
  );
  await waitUntilExit();
}

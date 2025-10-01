import React from 'react';
import { render, Box, Text, useInput } from 'ink';
import Gradient from 'ink-gradient';
import figures from 'figures';
import { getClient } from '../../utils/client.js';
import { Header } from '../../components/Header.js';
import { Banner } from '../../components/Banner.js';
import { SpinnerComponent } from '../../components/Spinner.js';
import { ErrorMessage } from '../../components/ErrorMessage.js';

interface ListOptions {
  devbox?: string;
}

const PAGE_SIZE = 10;
const MAX_FETCH = 100; // Limit initial fetch to prevent hanging

const ListSnapshotsUI: React.FC<{ devboxId?: string }> = ({ devboxId }) => {
  const [loading, setLoading] = React.useState(true);
  const [snapshots, setSnapshots] = React.useState<any[]>([]);
  const [error, setError] = React.useState<Error | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);

  React.useEffect(() => {
    const list = async () => {
      try {
        const client = getClient();
        const allSnapshots: any[] = [];

        let count = 0;
        const params = devboxId ? { devbox_id: devboxId } : {};
        for await (const snapshot of client.devboxes.listDiskSnapshots(params)) {
          allSnapshots.push(snapshot);
          count++;
          // Limit fetch to prevent hanging on large datasets
          if (count >= MAX_FETCH) {
            break;
          }
        }

        setSnapshots(allSnapshots);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    list();
  }, []);

  useInput((input, key) => {
    if (input === 'n' && currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    } else if (input === 'p' && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    } else if (input === 'q') {
      process.exit(0);
    }
  });

  const totalPages = Math.ceil(snapshots.length / PAGE_SIZE);
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, snapshots.length);
  const currentSnapshots = snapshots.slice(startIndex, endIndex);

  return (
    <>
      <Banner />
      <Header
        title="Snapshots"
        subtitle={devboxId ? `Filtering by devbox: ${devboxId}` : 'All snapshots'}
      />
      {loading && <SpinnerComponent message="Fetching snapshots..." />}
      {!loading && !error && snapshots.length === 0 && (
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
              {figures.info} No snapshots found
            </Text>
          </Box>
          <Box marginLeft={2}>
            <Text color="gray">Create a snapshot with: </Text>
            <Text color="cyan" bold>
              rln snapshot create &lt;devbox-id&gt;
            </Text>
          </Box>
        </Box>
      )}
      {!loading && !error && snapshots.length > 0 && (
        <>
          {/* Summary */}
          <Box
            borderStyle="round"
            borderColor="magenta"
            paddingX={3}
            paddingY={1}
            marginY={1}
            flexDirection="column"
          >
            <Box justifyContent="space-between">
              <Box>
                <Gradient name="passion">
                  <Text bold>{figures.star} Summary</Text>
                </Gradient>
              </Box>
              <Box>
                <Text color="cyan">
                  {totalPages > 1 && `Page ${currentPage + 1}/${totalPages} - `}
                  {snapshots.length}{snapshots.length >= MAX_FETCH && '+'} total
                </Text>
              </Box>
            </Box>
          </Box>

          {/* Snapshot List */}
          <Box flexDirection="column" marginTop={1}>
            {currentSnapshots.map((snapshot, index) => (
              <Box
                key={snapshot.id}
                flexDirection="column"
                borderStyle="round"
                borderColor="blue"
                paddingX={3}
                paddingY={1}
                marginBottom={1}
              >
                <Box justifyContent="space-between">
                  <Box>
                    <Text color="cyan" bold>
                      {figures.pointer}
                    </Text>
                    <Text> </Text>
                    <Gradient name="cristal">
                      <Text bold>{snapshot.name || snapshot.id.slice(0, 12)}</Text>
                    </Gradient>
                  </Box>
                  <Box>
                    <Text color={snapshot.status === 'ready' ? 'green' : 'yellow'}>
                      {snapshot.status === 'ready' ? figures.tick : figures.ellipsis}{' '}
                      {snapshot.status.toUpperCase()}
                    </Text>
                  </Box>
                </Box>
                <Box marginTop={1}>
                  <Text color="gray">{'─'.repeat(72)}</Text>
                </Box>
                <Box flexDirection="column" gap={1} marginTop={1}>
                  <Box>
                    <Text color="blueBright" bold>
                      {figures.info} ID:{' '}
                    </Text>
                    <Text color="gray">{snapshot.id.slice(0, 8)}...</Text>
                  </Box>
                  <Box>
                    <Text color="blueBright" bold>
                      {figures.play} Devbox:{' '}
                    </Text>
                    <Text color="gray">{snapshot.devbox_id?.slice(0, 8)}...</Text>
                  </Box>
                  {snapshot.created_at && (
                    <Box>
                      <Text color="blueBright" bold>
                        {figures.play} Created:{' '}
                      </Text>
                      <Text color="gray">
                        {new Date(snapshot.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <Box
              borderStyle="round"
              borderColor="blue"
              paddingX={3}
              paddingY={1}
              marginTop={1}
              flexDirection="column"
            >
              <Box justifyContent="space-between">
                <Box gap={3}>
                  {currentPage > 0 && (
                    <Box>
                      <Text color="cyan" bold>
                        [p]
                      </Text>
                      <Text color="gray"> Previous</Text>
                    </Box>
                  )}
                  {currentPage < totalPages - 1 && (
                    <Box>
                      <Text color="cyan" bold>
                        [n]
                      </Text>
                      <Text color="gray"> Next</Text>
                    </Box>
                  )}
                  <Box>
                    <Text color="red" bold>
                      [q]
                    </Text>
                    <Text color="gray"> Quit</Text>
                  </Box>
                </Box>
                <Box>
                  <Text color="gray" dimColor>
                    {figures.arrowRight} Press a key to navigate
                  </Text>
                </Box>
              </Box>
            </Box>
          )}
        </>
      )}
      {error && <ErrorMessage message="Failed to list snapshots" error={error} />}
    </>
  );
};

export async function listSnapshots(options: ListOptions) {
  console.clear();
  const { waitUntilExit } = render(<ListSnapshotsUI devboxId={options.devbox} />);
  await waitUntilExit();
}

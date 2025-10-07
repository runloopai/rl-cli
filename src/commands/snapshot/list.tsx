import React from 'react';
import { render, Box, Text, useInput, useStdout, useApp } from 'ink';
import figures from 'figures';
import { getClient } from '../../utils/client.js';
import { SpinnerComponent } from '../../components/Spinner.js';
import { ErrorMessage } from '../../components/ErrorMessage.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { Breadcrumb } from '../../components/Breadcrumb.js';
import { Table, createTextColumn, createComponentColumn } from '../../components/Table.js';
import { createExecutor } from '../../utils/CommandExecutor.js';
import { colors } from '../../utils/theme.js';

interface ListOptions {
  devbox?: string;
  output?: string;
}

const PAGE_SIZE = 10;
const MAX_FETCH = 100;

// Format time ago
const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
};

const ListSnapshotsUI: React.FC<{
  devboxId?: string;
  onBack?: () => void;
  onExit?: () => void;
}> = ({ devboxId, onBack, onExit }) => {
  const { stdout } = useStdout();
  const { exit: inkExit } = useApp();
  const [loading, setLoading] = React.useState(true);
  const [snapshots, setSnapshots] = React.useState<any[]>([]);
  const [error, setError] = React.useState<Error | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Calculate responsive column widths
  const terminalWidth = stdout?.columns || 120;
  const showDevboxId = terminalWidth >= 100 && !devboxId; // Hide devbox column if filtering by devbox
  const showFullId = terminalWidth >= 80;

  const idWidth = 25;
  const nameWidth = terminalWidth >= 120 ? 30 : 25;
  const devboxWidth = 15;
  const timeWidth = 20;

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
  }, [devboxId]);

  useInput((input, key) => {
    const pageSnapshots = currentSnapshots.length;

    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageSnapshots - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if ((input === 'n' || key.rightArrow) && currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
      setSelectedIndex(0);
    } else if ((input === 'p' || key.leftArrow) && currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setSelectedIndex(0);
    } else if (key.escape) {
      if (onBack) {
        onBack();
      } else if (onExit) {
        onExit();
      } else {
        inkExit();
      }
    }
  });

  const totalPages = Math.ceil(snapshots.length / PAGE_SIZE);
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, snapshots.length);
  const currentSnapshots = snapshots.slice(startIndex, endIndex);

  const ready = snapshots.filter((s) => s.status === 'ready').length;
  const pending = snapshots.filter((s) => s.status !== 'ready').length;

  return (
    <>
      <Breadcrumb
        items={[
          { label: 'Snapshots', active: !devboxId },
          ...(devboxId ? [{ label: `Devbox: ${devboxId}`, active: true }] : []),
        ]}
      />
      {loading && <SpinnerComponent message="Loading snapshots..." />}
      {!loading && !error && snapshots.length === 0 && (
        <Box>
          <Text color={colors.warning}>{figures.info}</Text>
          <Text> No snapshots found. Try: </Text>
          <Text color={colors.primary} bold>
            rln snapshot create &lt;devbox-id&gt;
          </Text>
        </Box>
      )}
      {!loading && !error && snapshots.length > 0 && (
        <>
          <Box marginBottom={1}>
            <Text color={colors.success}>
              {figures.tick} {ready}
            </Text>
            <Text> </Text>
            <Text color={colors.warning}>
              {figures.ellipsis} {pending}
            </Text>
            <Text> </Text>
            <Text color={colors.primary}>
              {figures.hamburger} {snapshots.length}
              {snapshots.length >= MAX_FETCH && '+'}
            </Text>
            {totalPages > 1 && (
              <>
                <Text color={colors.textDim}> • </Text>
                <Text color={colors.textDim} dimColor>
                  Page {currentPage + 1}/{totalPages}
                </Text>
              </>
            )}
          </Box>

          <Table
            data={currentSnapshots}
            keyExtractor={(snapshot: any) => snapshot.id}
            selectedIndex={selectedIndex}
            columns={[
              createComponentColumn(
                'status',
                'Status',
                (snapshot: any) => <StatusBadge status={snapshot.status} showText={false} />,
                { width: 2 }
              ),
              createTextColumn(
                'id',
                'ID',
                (snapshot: any) => showFullId ? snapshot.id : snapshot.id.slice(0, 13),
                { width: showFullId ? idWidth : 15, color: colors.textDim, dimColor: true, bold: false }
              ),
              createTextColumn(
                'name',
                'Name',
                (snapshot: any) => snapshot.name || '(unnamed)',
                { width: nameWidth }
              ),
              createTextColumn(
                'devbox',
                'Devbox',
                (snapshot: any) => snapshot.devbox_id || '',
                { width: devboxWidth, color: colors.primary, dimColor: true, bold: false, visible: showDevboxId }
              ),
              createTextColumn(
                'created',
                'Created',
                (snapshot: any) => snapshot.created_at ? formatTimeAgo(new Date(snapshot.created_at).getTime()) : '',
                { width: timeWidth, color: colors.textDim, dimColor: true, bold: false }
              ),
            ]}
          />

          <Box marginTop={1}>
            <Text color={colors.textDim} dimColor>
              {figures.arrowUp}
              {figures.arrowDown} Navigate •
            </Text>
            {totalPages > 1 && (
              <Text color={colors.textDim} dimColor>
                {' '}
                {figures.arrowLeft}
                {figures.arrowRight} Page •
              </Text>
            )}
            <Text color={colors.textDim} dimColor>
              {' '}
              [Esc] Back
            </Text>
          </Box>
        </>
      )}
      {error && <ErrorMessage message="Failed to list snapshots" error={error} />}
    </>
  );
};

// Export the UI component for use in the main menu
export { ListSnapshotsUI };

export async function listSnapshots(options: ListOptions) {
  const executor = createExecutor(options);

  await executor.executeList(
    async () => {
      const client = executor.getClient();
      const params = options.devbox ? { devbox_id: options.devbox } : {};
      return executor.fetchFromIterator(client.devboxes.listDiskSnapshots(params), {
        limit: PAGE_SIZE,
      });
    },
    () => <ListSnapshotsUI devboxId={options.devbox} />,
    PAGE_SIZE
  );
}

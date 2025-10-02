import React from 'react';
import { render, Box, Text, useInput, useApp, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import figures from 'figures';
import { getClient } from '../../utils/client.js';
import { Header } from '../../components/Header.js';
import { Banner } from '../../components/Banner.js';
import { SpinnerComponent } from '../../components/Spinner.js';
import { ErrorMessage } from '../../components/ErrorMessage.js';
import { SuccessMessage } from '../../components/SuccessMessage.js';
import { StatusBadge, getStatusDisplay } from '../../components/StatusBadge.js';
import { MetadataDisplay } from '../../components/MetadataDisplay.js';
import { Breadcrumb } from '../../components/Breadcrumb.js';
import { Table, createTextColumn, createComponentColumn } from '../../components/Table.js';
import { createExecutor } from '../../utils/CommandExecutor.js';
import { DevboxDetailPage } from '../../components/DevboxDetailPage.js';
import { DevboxCreatePage } from '../../components/DevboxCreatePage.js';
import { DevboxActionsMenu } from '../../components/DevboxActionsMenu.js';

// Format time ago in a succinct way
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

interface ListOptions {
  status?: string;
  output?: string;
}

const MAX_FETCH = 100;
const DEFAULT_PAGE_SIZE = 10;

const ListDevboxesUI: React.FC<{ status?: string }> = ({ status }) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [loading, setLoading] = React.useState(true);
  const [devboxes, setDevboxes] = React.useState<any[]>([]);
  const [error, setError] = React.useState<Error | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showDetails, setShowDetails] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [showActions, setShowActions] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshIcon, setRefreshIcon] = React.useState(0);

  // Calculate responsive dimensions
  const terminalWidth = stdout?.columns || 120;
  const terminalHeight = stdout?.rows || 30;

  // Calculate dynamic page size based on terminal height
  // Account for: Banner (3-4 lines) + Breadcrumb (1) + Header (1) + Stats (2) + Help text (2) + Margins (2) + Header row (1) = ~12 lines
  const PAGE_SIZE = Math.max(5, terminalHeight - 12);

  const fixedWidth = 4; // pointer + spaces
  const statusIconWidth = 2;
  const statusTextWidth = 10;
  const timeWidth = 20;
  const capabilitiesWidth = 18;
  const tagWidth = 6;

  // ID is always full width (25 chars for dbx_31CYd5LLFbBxst8mqnUjO format)
  const idWidth = 26;

  // Responsive layout based on terminal width
  const showCapabilities = terminalWidth >= 120;
  const showTags = terminalWidth >= 110;

  // Name width is flexible and uses remaining space
  let nameWidth = 15;
  if (terminalWidth >= 120) {
    const remainingWidth = terminalWidth - fixedWidth - statusIconWidth - idWidth - statusTextWidth - timeWidth - capabilitiesWidth - tagWidth - 12;
    nameWidth = Math.max(15, remainingWidth);
  } else if (terminalWidth >= 110) {
    const remainingWidth = terminalWidth - fixedWidth - statusIconWidth - idWidth - statusTextWidth - timeWidth - tagWidth - 10;
    nameWidth = Math.max(12, remainingWidth);
  } else {
    const remainingWidth = terminalWidth - fixedWidth - statusIconWidth - idWidth - statusTextWidth - timeWidth - 10;
    nameWidth = Math.max(8, remainingWidth);
  }

  React.useEffect(() => {
    const list = async (isInitialLoad: boolean = false) => {
      try {
        // Only show refreshing indicator on initial load
        if (isInitialLoad) {
          setRefreshing(true);
        }
        const client = getClient();
        const allDevboxes: any[] = [];

        let count = 0;
        for await (const devbox of client.devboxes.list()) {
          if (!status || devbox.status === status) {
            allDevboxes.push(devbox);
          }
          count++;
          if (count >= MAX_FETCH) {
            break;
          }
        }

        // Only update if data actually changed
        setDevboxes((prev) => {
          const hasChanged = JSON.stringify(prev) !== JSON.stringify(allDevboxes);
          return hasChanged ? allDevboxes : prev;
        });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
        // Show refresh indicator briefly
        if (isInitialLoad) {
          setTimeout(() => setRefreshing(false), 300);
        }
      }
    };

    list(true);

    // Poll every 3 seconds (increased from 2), but only when in list view
    const interval = setInterval(() => {
      if (!showDetails && !showCreate && !showActions) {
        list(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [showDetails, showCreate, showActions]);

  // Animate refresh icon only when in list view
  React.useEffect(() => {
    if (showDetails || showCreate || showActions) {
      return; // Don't animate when not in list view
    }

    const interval = setInterval(() => {
      setRefreshIcon((prev) => (prev + 1) % 10);
    }, 80);
    return () => clearInterval(interval);
  }, [showDetails, showCreate, showActions]);

  useInput((input, key) => {
    const pageDevboxes = currentDevboxes.length;

    // Skip input handling when in details view - let DevboxDetailPage handle it
    if (showDetails) {
      return;
    }

    // Skip input handling when in create view - let DevboxCreatePage handle it
    if (showCreate) {
      return;
    }

    // Skip input handling when in actions view - let DevboxActionsMenu handle it
    if (showActions) {
      return;
    }

    // Handle list view
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageDevboxes - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if ((input === 'n' || key.rightArrow) && currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
      setSelectedIndex(0);
    } else if ((input === 'p' || key.leftArrow) && currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setSelectedIndex(0);
    } else if (key.return) {
      console.clear();
      setShowDetails(true);
    } else if (input === 'a') {
      console.clear();
      setShowActions(true);
    } else if (input === 'c') {
      console.clear();
      setShowCreate(true);
    } else if (input === 'o' && selectedDevbox) {
      // Open in browser
      const url = `https://platform.runloop.ai/devboxes/${selectedDevbox.id}`;
      const openBrowser = async () => {
        const { exec } = await import('child_process');
        const platform = process.platform;

        let openCommand: string;
        if (platform === 'darwin') {
          openCommand = `open "${url}"`;
        } else if (platform === 'win32') {
          openCommand = `start "${url}"`;
        } else {
          openCommand = `xdg-open "${url}"`;
        }

        exec(openCommand);
      };
      openBrowser();
    } else if (input === 'q') {
      process.exit(0);
    }
  });

  const running = devboxes.filter((d) => d.status === 'running').length;
  const stopped = devboxes.filter((d) =>
    ['stopped', 'suspended'].includes(d.status)
  ).length;

  const totalPages = Math.ceil(devboxes.length / PAGE_SIZE);
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, devboxes.length);
  const currentDevboxes = devboxes.slice(startIndex, endIndex);
  const selectedDevbox = currentDevboxes[selectedIndex];

  // Create view
  if (showCreate) {
    return (
      <DevboxCreatePage
        onBack={() => {
          setShowCreate(false);
        }}
        onCreate={(devbox) => {
          // Refresh the list after creation
          setShowCreate(false);
          // The list will auto-refresh via the polling effect
        }}
      />
    );
  }

  // Actions view
  if (showActions && selectedDevbox) {
    return (
      <DevboxActionsMenu
        devbox={selectedDevbox}
        onBack={() => setShowActions(false)}
        breadcrumbItems={[
          { label: 'Devboxes' },
          { label: selectedDevbox.name || selectedDevbox.id, active: true }
        ]}
      />
    );
  }

  // Details view
  if (showDetails && selectedDevbox) {
    return <DevboxDetailPage devbox={selectedDevbox} onBack={() => setShowDetails(false)} />;
  }

  // List view
  return (
    <>
      {/* //<Banner /> */}
      <Breadcrumb items={[
        { label: 'Devboxes', active: true }
      ]} />
      {/* <Header title="Devboxes" /> */}
      {loading && <SpinnerComponent message="Loading..." />}
      {!loading && !error && devboxes.length === 0 && (
        <Box>
          <Text color="yellow">{figures.info}</Text>
          <Text> No devboxes found. Try: </Text>
          <Text color="cyan" bold>
            rln devbox create
          </Text>
        </Box>
      )}
      {!loading && !error && devboxes.length > 0 && (
        <>
          <Table
            data={currentDevboxes}
            keyExtractor={(devbox: any) => devbox.id}
            selectedIndex={selectedIndex}
            title={`devboxes[${devboxes.length}]`}
            columns={[
              {
                key: 'statusIcon',
                label: '',
                width: statusIconWidth,
                render: (devbox: any, index: number, isSelected: boolean) => {
                  const statusDisplay = getStatusDisplay(devbox.status);
                  const status = devbox.status;
                  let color: string = 'gray';
                  if (status === 'running') color = 'green';
                  else if (status === 'stopped' || status === 'suspended') color = 'gray';
                  else if (status === 'starting' || status === 'stopping') color = 'yellow';
                  else if (status === 'failed') color = 'red';

                  const padded = statusDisplay.icon.padEnd(statusIconWidth, ' ');

                  return (
                    <Text color={isSelected ? 'white' : color} bold={true} inverse={isSelected}>
                      {padded}
                    </Text>
                  );
                }
              },
              createTextColumn(
                'id',
                'ID',
                (devbox: any) => devbox.id,
                { width: idWidth, color: 'gray', dimColor: true, bold: false }
              ),
              {
                key: 'statusText',
                label: 'Status',
                width: statusTextWidth,
                render: (devbox: any, index: number, isSelected: boolean) => {
                  const statusDisplay = getStatusDisplay(devbox.status);
                  const status = devbox.status;
                  let color: string = 'gray';
                  if (status === 'running') color = 'green';
                  else if (status === 'stopped' || status === 'suspended') color = 'gray';
                  else if (status === 'starting' || status === 'stopping') color = 'yellow';
                  else if (status === 'failed') color = 'red';

                  const truncated = statusDisplay.text.slice(0, statusTextWidth);
                  const padded = truncated.padEnd(statusTextWidth, ' ');

                  return (
                    <Text color={isSelected ? 'white' : color} bold={true} inverse={isSelected}>
                      {padded}
                    </Text>
                  );
                }
              },
              createTextColumn(
                'name',
                'Name',
                (devbox: any) => devbox.name || '',
                { width: nameWidth }
              ),
              createTextColumn(
                'capabilities',
                'Capabilities',
                (devbox: any) => {
                  const hasCapabilities = devbox.capabilities && devbox.capabilities.filter((c: string) => c !== 'unknown').length > 0;
                  return hasCapabilities
                    ? `[${devbox.capabilities
                        .filter((c: string) => c !== 'unknown')
                        .map((c: string) => c === 'computer_usage' ? 'comp' : c === 'browser_usage' ? 'browser' : c === 'docker_in_docker' ? 'docker' : c)
                        .join(',')}]`
                    : '';
                },
                { width: capabilitiesWidth, color: 'blue', dimColor: true, bold: false, visible: showCapabilities }
              ),
              createTextColumn(
                'tags',
                'Tags',
                (devbox: any) => devbox.blueprint_id ? '[bp]' : devbox.snapshot_id ? '[snap]' : '',
                { width: tagWidth, color: 'yellow', dimColor: true, bold: false, visible: showTags }
              ),
              createTextColumn(
                'created',
                'Created',
                (devbox: any) => devbox.create_time_ms ? formatTimeAgo(devbox.create_time_ms) : '',
                { width: timeWidth, color: 'gray', dimColor: true, bold: false }
              ),
            ]}
          />

          {/* Statistics Bar */}
          <Box marginTop={1} paddingX={1}>
            <Text color="cyan" bold>
              {figures.hamburger} {devboxes.length}
              {devboxes.length >= MAX_FETCH && '+'}
            </Text>
            <Text color="gray" dimColor> total</Text>
            {totalPages > 1 && (
              <>
                <Text color="gray" dimColor> • </Text>
                <Text color="gray" dimColor>
                  Page {currentPage + 1} of {totalPages}
                </Text>
              </>
            )}
            <Text color="gray" dimColor> • </Text>
            <Text color="gray" dimColor>
              Showing {startIndex + 1}-{endIndex} of {devboxes.length}
            </Text>
            <Text> </Text>
            {refreshing ? (
              <Text color="cyan">
                {['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'][refreshIcon % 10]}
              </Text>
            ) : (
              <Text color="green">
                {figures.circleFilled}
              </Text>
            )}
          </Box>

          {/* Help Bar */}
          <Box marginTop={1} paddingX={1}>
            <Text color="gray" dimColor>
              {figures.arrowUp}
              {figures.arrowDown} Navigate
            </Text>
            {totalPages > 1 && (
              <Text color="gray" dimColor>
                {' '}• {figures.arrowLeft}{figures.arrowRight} Page
              </Text>
            )}
            <Text color="gray" dimColor>
              {' '}• [Enter] Details • [a] Actions • [c] Create • [o] Browser • [q] Quit
            </Text>
          </Box>
        </>
      )}
      {error && <ErrorMessage message="Failed to list devboxes" error={error} />}
    </>
  );
};

export async function listDevboxes(options: ListOptions) {
  const executor = createExecutor(options);

  await executor.executeList(
    async () => {
      const client = executor.getClient();
      return executor.fetchFromIterator(client.devboxes.list(), {
        filter: options.status ? (devbox: any) => devbox.status === options.status : undefined,
        limit: DEFAULT_PAGE_SIZE,
      });
    },
    () => <ListDevboxesUI status={options.status} />,
    DEFAULT_PAGE_SIZE
  );

  // Check if we need to spawn SSH after Ink exit
  const sshCommand = (global as any).__sshCommand;
  if (sshCommand) {
    delete (global as any).__sshCommand;

    // Import spawn
    const { spawnSync } = await import('child_process');

    // Clear and show connection message
    console.clear();
    console.log(`\nConnecting to devbox ${sshCommand.devboxName}...\n`);

    // Spawn SSH in foreground
    const result = spawnSync('ssh', [
      '-i', sshCommand.keyPath,
      '-o', `ProxyCommand=${sshCommand.proxyCommand}`,
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      `${sshCommand.sshUser}@${sshCommand.url}`
    ], {
      stdio: 'inherit'
    });

    process.exit(result.status || 0);
  }
}

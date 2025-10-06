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
import { ActionsPopup } from '../../components/ActionsPopup.js';

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
  const [showPopup, setShowPopup] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshIcon, setRefreshIcon] = React.useState(0);
  const [searchMode, setSearchMode] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [totalCount, setTotalCount] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  const pageCache = React.useRef<Map<number, any[]>>(new Map());
  const lastIdCache = React.useRef<Map<number, string>>(new Map());

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

  // Define allOperations
  const allOperations = [
    { key: 'logs', label: 'View Logs', color: 'blue', icon: figures.info, shortcut: 'l' },
    { key: 'exec', label: 'Execute Command', color: 'green', icon: figures.play, shortcut: 'e' },
    { key: 'upload', label: 'Upload File', color: 'green', icon: figures.arrowUp, shortcut: 'u' },
    { key: 'snapshot', label: 'Create Snapshot', color: 'yellow', icon: figures.circleFilled, shortcut: 'n' },
    { key: 'ssh', label: 'SSH onto the box', color: 'cyan', icon: figures.arrowRight, shortcut: 's' },
    { key: 'tunnel', label: 'Open Tunnel', color: 'magenta', icon: figures.pointerSmall, shortcut: 't' },
    { key: 'suspend', label: 'Suspend Devbox', color: 'yellow', icon: figures.squareSmallFilled, shortcut: 'p' },
    { key: 'resume', label: 'Resume Devbox', color: 'green', icon: figures.play, shortcut: 'r' },
    { key: 'delete', label: 'Shutdown Devbox', color: 'red', icon: figures.cross, shortcut: 'd' },
  ];

  React.useEffect(() => {
    const list = async (isInitialLoad: boolean = false) => {
      try {
        // Only show refreshing indicator on initial load
        if (isInitialLoad) {
          setRefreshing(true);
        }

        // Check if we have cached data for this page
        if (!isInitialLoad && pageCache.current.has(currentPage)) {
          setDevboxes(pageCache.current.get(currentPage) || []);
          setLoading(false);
          return;
        }

        const client = getClient();
        const pageDevboxes: any[] = [];

        // Get starting_after cursor from previous page's last ID
        const startingAfter = currentPage > 0 ? lastIdCache.current.get(currentPage - 1) : undefined;

        // Build query params
        const queryParams: any = {
          limit: PAGE_SIZE,
        };
        if (startingAfter) {
          queryParams.starting_after = startingAfter;
        }
        if (status) {
          queryParams.status = status as 'provisioning' | 'initializing' | 'running' | 'suspending' | 'suspended' | 'resuming' | 'failure' | 'shutdown';
        }

        // Fetch only the current page
        const page = await client.devboxes.list(queryParams);

        // Collect items from the page - only get PAGE_SIZE items, don't auto-paginate
        let count = 0;
        for await (const devbox of page) {
          pageDevboxes.push(devbox);
          count++;
          // Break after getting PAGE_SIZE items to prevent auto-pagination
          if (count >= PAGE_SIZE) {
            break;
          }
        }

        // Update pagination metadata from the page object
        // These properties are on the page object itself
        const total = (page as any).total_count || pageDevboxes.length;
        const more = (page as any).has_more || false;

        setTotalCount(total);
        setHasMore(more);

        // Cache the page data and last ID
        if (pageDevboxes.length > 0) {
          pageCache.current.set(currentPage, pageDevboxes);
          lastIdCache.current.set(currentPage, pageDevboxes[pageDevboxes.length - 1].id);
        }

        // Update devboxes for current page
        setDevboxes((prev) => {
          const hasChanged = JSON.stringify(prev) !== JSON.stringify(pageDevboxes);
          return hasChanged ? pageDevboxes : prev;
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
        // Clear cache on refresh to get latest data
        pageCache.current.clear();
        lastIdCache.current.clear();
        list(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [showDetails, showCreate, showActions, currentPage]);

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

    // Skip input handling when in search mode - let TextInput handle it
    if (searchMode) {
      if (key.escape) {
        setSearchMode(false);
        setSearchQuery('');
      }
      return;
    }

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

    // Handle popup navigation
    if (showPopup) {
      if (key.escape || input === 'q') {
        console.clear();
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (key.upArrow && selectedOperation > 0) {
        setSelectedOperation(selectedOperation - 1);
      } else if (key.downArrow && selectedOperation < operations.length - 1) {
        setSelectedOperation(selectedOperation + 1);
      } else if (key.return) {
        // Execute the selected operation
        console.clear();
        setShowPopup(false);
        setShowActions(true);
      } else if (input) {
        // Check for shortcut match
        const matchedOpIndex = operations.findIndex(op => op.shortcut === input);
        if (matchedOpIndex !== -1) {
          setSelectedOperation(matchedOpIndex);
          console.clear();
          setShowPopup(false);
          setShowActions(true);
        }
      }
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
      setShowPopup(true);
      setSelectedOperation(0);
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
    } else if (input === '/') {
      setSearchMode(true);
    } else if (key.escape) {
      if (searchQuery) {
        // Clear search when Esc is pressed and there's an active search
        setSearchQuery('');
        setCurrentPage(0);
        setSelectedIndex(0);
      } else {
        // Go back to home
        exit();
      }
    }
  });

  // Filter devboxes based on search query (client-side only for current page)
  const filteredDevboxes = React.useMemo(() => {
    if (!searchQuery.trim()) return devboxes;

    const query = searchQuery.toLowerCase();
    return devboxes.filter(devbox => {
      return (
        devbox.id?.toLowerCase().includes(query) ||
        devbox.name?.toLowerCase().includes(query) ||
        devbox.status?.toLowerCase().includes(query)
      );
    });
  }, [devboxes, searchQuery]);

  // Current page is already fetched, no need to slice
  const currentDevboxes = filteredDevboxes;

  // Ensure selected index is within bounds after filtering
  React.useEffect(() => {
    if (currentDevboxes.length > 0 && selectedIndex >= currentDevboxes.length) {
      setSelectedIndex(Math.max(0, currentDevboxes.length - 1));
    }
  }, [currentDevboxes.length, selectedIndex]);

  const selectedDevbox = currentDevboxes[selectedIndex];

  // Calculate pagination info
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + currentDevboxes.length;

  // Filter operations based on devbox status
  const operations = selectedDevbox ? allOperations.filter(op => {
    const status = selectedDevbox.status;

    // When suspended: logs and resume
    if (status === 'suspended') {
      return op.key === 'resume' || op.key === 'logs';
    }

    // When not running (shutdown, failure, etc): only logs
    if (status !== 'running' && status !== 'provisioning' && status !== 'initializing') {
      return op.key === 'logs';
    }

    // When running: everything except resume
    if (status === 'running') {
      return op.key !== 'resume';
    }

    // Default for transitional states (provisioning, initializing)
    return op.key === 'logs' || op.key === 'delete';
  }) : allOperations;

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
    const selectedOp = operations[selectedOperation];
    return (
      <DevboxActionsMenu
        devbox={selectedDevbox}
        onBack={() => {
          setShowActions(false);
          setSelectedOperation(0);
        }}
        breadcrumbItems={[
          { label: 'Devboxes' },
          { label: selectedDevbox.name || selectedDevbox.id, active: true }
        ]}
        initialOperation={selectedOp?.key}
        skipOperationsMenu={true}
      />
    );
  }

  // Details view
  if (showDetails && selectedDevbox) {
    return <DevboxDetailPage devbox={selectedDevbox} onBack={() => setShowDetails(false)} />;
  }

  // Show popup with table in background
  if (showPopup && selectedDevbox) {
    return (
      <>
        <Breadcrumb items={[
          { label: 'Devboxes', active: true }
        ]} />
        {!loading && !error && devboxes.length > 0 && (
          <>
            <Table
              data={currentDevboxes}
              keyExtractor={(devbox: any) => devbox.id}
              selectedIndex={selectedIndex}
              title={`devboxes[${totalCount}]`}
              columns={[
                {
                  key: 'statusIcon',
                  label: '',
                  width: statusIconWidth,
                  render: (devbox: any, index: number, isSelected: boolean) => {
                    const statusDisplay = getStatusDisplay(devbox.status);

                    // Truncate icon to fit width and pad
                    const icon = statusDisplay.icon.slice(0, statusIconWidth);
                    const padded = icon.padEnd(statusIconWidth, ' ');

                    return (
                      <Text color={isSelected ? 'white' : statusDisplay.color} bold={true} inverse={isSelected}>
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

                    const truncated = statusDisplay.text.slice(0, statusTextWidth);
                    const padded = truncated.padEnd(statusTextWidth, ' ');

                    return (
                      <Text color={isSelected ? 'white' : statusDisplay.color} bold={true} inverse={isSelected}>
                        {padded}
                      </Text>
                    );
                  }
                },
                createTextColumn(
                  'name',
                  'Name',
                  (devbox: any) => devbox.name || '',
                  { width: nameWidth, dimColor: true }
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
          </>
        )}

        {/* Popup overlaying - use negative margin to pull it up over the table */}
        <Box marginTop={-Math.min(operations.length + 10, PAGE_SIZE + 5)} justifyContent="center">
          <ActionsPopup
            devbox={selectedDevbox}
            operations={operations}
            selectedOperation={selectedOperation}
            onClose={() => setShowPopup(false)}
          />
        </Box>
      </>
    );
  }

  // If loading or error, show that first
  if (loading) {
    return (
      <>
        <Breadcrumb items={[
          { label: 'Devboxes', active: true }
        ]} />
        <SpinnerComponent message="Loading..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Breadcrumb items={[
          { label: 'Devboxes', active: true }
        ]} />
        <ErrorMessage message="Failed to list devboxes" error={error} />
      </>
    );
  }

  if (!loading && !error && devboxes.length === 0) {
    return (
      <>
        <Breadcrumb items={[
          { label: 'Devboxes', active: true }
        ]} />
        <Box>
          <Text color="yellow">{figures.info}</Text>
          <Text> No devboxes found. Try: </Text>
          <Text color="cyan" bold>
            rln devbox create
          </Text>
        </Box>
      </>
    );
  }

  // List view with data
  return (
    <>
      <Breadcrumb items={[
        { label: 'Devboxes', active: true }
      ]} />
      {currentDevboxes && currentDevboxes.length >= 0 && (
        <>
          {searchMode && (
            <Box marginBottom={1}>
              <Text color="cyan">{figures.pointerSmall} Search: </Text>
              <TextInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Type to search (name, id, status)..."
                onSubmit={() => {
                  setSearchMode(false);
                  setCurrentPage(0);
                  setSelectedIndex(0);
                }}
              />
              <Text color="gray" dimColor> [Esc to cancel]</Text>
            </Box>
          )}
          {!searchMode && searchQuery && (
            <Box marginBottom={1}>
              <Text color="cyan">{figures.info} Searching for: </Text>
              <Text color="yellow" bold>{searchQuery}</Text>
              <Text color="gray" dimColor> ({currentDevboxes.length} results) [/ to edit, Esc to clear]</Text>
            </Box>
          )}
          <Table
            key={`table-${searchQuery}-${currentPage}`}
            data={currentDevboxes}
            keyExtractor={(devbox: any) => devbox.id}
            selectedIndex={selectedIndex}
            title={`devboxes[${searchQuery ? currentDevboxes.length : totalCount}]`}
            columns={[
              {
                key: 'statusIcon',
                label: '',
                width: statusIconWidth,
                render: (devbox: any, index: number, isSelected: boolean) => {
                  const statusDisplay = getStatusDisplay(devbox.status);

                  // Truncate icon to fit width and pad
                  const icon = statusDisplay.icon.slice(0, statusIconWidth);
                  const padded = icon.padEnd(statusIconWidth, ' ');

                  return (
                    <Text color={isSelected ? 'white' : statusDisplay.color} bold={true} inverse={isSelected}>
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

                  const truncated = statusDisplay.text.slice(0, statusTextWidth);
                  const padded = truncated.padEnd(statusTextWidth, ' ');

                  return (
                    <Text color={isSelected ? 'white' : statusDisplay.color} bold={true} inverse={isSelected}>
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
              {figures.hamburger} {totalCount}
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
              Showing {startIndex + 1}-{endIndex} of {totalCount}
            </Text>
            {hasMore && (
              <Text color="gray" dimColor> (more available)</Text>
            )}
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
              {' '}• [Enter] Details • [a] Actions • [c] Create • [/] Search • [o] Browser • [Esc] Back
            </Text>
          </Box>

        </>
      )}
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

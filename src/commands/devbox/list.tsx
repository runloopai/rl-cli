import React from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { getClient } from "../../utils/client.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { getStatusDisplay } from "../../components/StatusBadge.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";
import { Table, createTextColumn } from "../../components/Table.js";
import { formatTimeAgo } from "../../components/ResourceListView.js";
import { createExecutor } from "../../utils/CommandExecutor.js";
import { DevboxDetailPage } from "../../components/DevboxDetailPage.js";
import { DevboxCreatePage } from "../../components/DevboxCreatePage.js";
import { DevboxActionsMenu } from "../../components/DevboxActionsMenu.js";
import { ResourceActionsMenu } from "../../components/ResourceActionsMenu.js";
import { ActionsPopup } from "../../components/ActionsPopup.js";
import { getDevboxUrl } from "../../utils/url.js";
import {
  runSSHSession,
  type SSHSessionConfig,
} from "../../utils/sshSession.js";
import { colors } from "../../utils/theme.js";

interface ListOptions {
  status?: string;
  output?: string;
}

const DEFAULT_PAGE_SIZE = 10;

const ListDevboxesUI: React.FC<{
  status?: string;
  onSSHRequest?: (config: SSHSessionConfig) => void;
  focusDevboxId?: string;
  onBack?: () => void;
  onExit?: () => void;
}> = ({ status, onSSHRequest, focusDevboxId, onBack, onExit }) => {
  const { exit: inkExit } = useApp();
  const { stdout } = useStdout();
  const [initialLoading, setInitialLoading] = React.useState(true);
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
  const isNavigating = React.useRef(false);
  const [searchMode, setSearchMode] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
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
  const sourceWidth = 26;

  // ID is always full width (25 chars for dbx_31CYd5LLFbBxst8mqnUjO format)
  const idWidth = 26;

  // Responsive layout based on terminal width
  const showCapabilities = terminalWidth >= 140;
  const showSource = terminalWidth >= 120;

  // Name width is flexible and uses remaining space
  let nameWidth = 15;
  if (terminalWidth >= 120) {
    const remainingWidth =
      terminalWidth -
      fixedWidth -
      statusIconWidth -
      idWidth -
      statusTextWidth -
      timeWidth -
      capabilitiesWidth -
      sourceWidth -
      12;
    nameWidth = Math.max(15, remainingWidth);
  } else if (terminalWidth >= 110) {
    const remainingWidth =
      terminalWidth -
      fixedWidth -
      statusIconWidth -
      idWidth -
      statusTextWidth -
      timeWidth -
      sourceWidth -
      10;
    nameWidth = Math.max(12, remainingWidth);
  } else {
    const remainingWidth =
      terminalWidth -
      fixedWidth -
      statusIconWidth -
      idWidth -
      statusTextWidth -
      timeWidth -
      10;
    nameWidth = Math.max(8, remainingWidth);
  }

  // Define allOperations
  const allOperations = [
    {
      key: "logs",
      label: "View Logs",
      color: colors.info,
      icon: figures.info,
      shortcut: "l",
    },
    {
      key: "exec",
      label: "Execute Command",
      color: colors.success,
      icon: figures.play,
      shortcut: "e",
    },
    {
      key: "upload",
      label: "Upload File",
      color: colors.success,
      icon: figures.arrowUp,
      shortcut: "u",
    },
    {
      key: "snapshot",
      label: "Create Snapshot",
      color: colors.warning,
      icon: figures.circleFilled,
      shortcut: "n",
    },
    {
      key: "ssh",
      label: "SSH onto the box",
      color: colors.primary,
      icon: figures.arrowRight,
      shortcut: "s",
    },
    {
      key: "tunnel",
      label: "Open Tunnel",
      color: colors.secondary,
      icon: figures.pointerSmall,
      shortcut: "t",
    },
    {
      key: "suspend",
      label: "Suspend Devbox",
      color: colors.warning,
      icon: figures.squareSmallFilled,
      shortcut: "p",
    },
    {
      key: "resume",
      label: "Resume Devbox",
      color: colors.success,
      icon: figures.play,
      shortcut: "r",
    },
    {
      key: "delete",
      label: "Shutdown Devbox",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  // Check if we need to focus on a specific devbox after returning from SSH
  React.useEffect(() => {
    if (focusDevboxId && devboxes.length > 0 && !initialLoading) {
      // Find the devbox in the current page
      const devboxIndex = devboxes.findIndex((d) => d.id === focusDevboxId);
      if (devboxIndex !== -1) {
        setSelectedIndex(devboxIndex);
        setShowDetails(true);
      }
    }
  }, [devboxes, initialLoading, focusDevboxId]);

  // Clear cache when search query changes
  React.useEffect(() => {
    pageCache.current.clear();
    lastIdCache.current.clear();
    setCurrentPage(0);
  }, [searchQuery]);

  React.useEffect(() => {
    const list = async (
      isInitialLoad: boolean = false,
      isBackgroundRefresh: boolean = false,
    ) => {
      try {
        // Set navigating flag at the start (but not for background refresh)
        if (!isBackgroundRefresh) {
          isNavigating.current = true;
        }

        // Only show refreshing indicator on initial load
        if (isInitialLoad) {
          setRefreshing(true);
        }

        // Check if we have cached data for this page
        if (
          !isInitialLoad &&
          !isBackgroundRefresh &&
          pageCache.current.has(currentPage)
        ) {
          setDevboxes(pageCache.current.get(currentPage) || []);
          isNavigating.current = false;
          return;
        }

        const client = getClient();
        const pageDevboxes: any[] = [];

        // Get starting_after cursor from previous page's last ID
        const startingAfter =
          currentPage > 0
            ? lastIdCache.current.get(currentPage - 1)
            : undefined;

        // Build query params
        const queryParams: any = {
          limit: PAGE_SIZE,
        };
        if (startingAfter) {
          queryParams.starting_after = startingAfter;
        }
        if (status) {
          queryParams.status = status as
            | "provisioning"
            | "initializing"
            | "running"
            | "suspending"
            | "suspended"
            | "resuming"
            | "failure"
            | "shutdown";
        }
        if (searchQuery) {
          queryParams.search = searchQuery;
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
          lastIdCache.current.set(
            currentPage,
            pageDevboxes[pageDevboxes.length - 1].id,
          );
        }

        // Update devboxes for current page
        setDevboxes((prev) => {
          const hasChanged =
            JSON.stringify(prev) !== JSON.stringify(pageDevboxes);
          return hasChanged ? pageDevboxes : prev;
        });
      } catch (err) {
        setError(err as Error);
      } finally {
        if (!isBackgroundRefresh) {
          isNavigating.current = false;
        }
        // Only set initialLoading to false after first successful load
        if (isInitialLoad) {
          setInitialLoading(false);
          setTimeout(() => setRefreshing(false), 300);
        }
      }
    };

    // Only treat as initial load on first mount
    const isFirstMount = initialLoading;
    list(isFirstMount, false);

    // Poll every 3 seconds (increased from 2), but only when in list view and not navigating
    const interval = setInterval(() => {
      if (
        !showDetails &&
        !showCreate &&
        !showActions &&
        !isNavigating.current
      ) {
        // Don't clear cache on background refresh - just update the current page
        list(false, true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [showDetails, showCreate, showActions, currentPage, searchQuery]);

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
    // Handle Ctrl+C to force exit
    if (key.ctrl && input === "c") {
      process.stdout.write("\x1b[?1049l"); // Exit alternate screen
      process.exit(130);
    }

    const pageDevboxes = currentDevboxes.length;

    // Skip input handling when in search mode - let TextInput handle it
    if (searchMode) {
      if (key.escape) {
        setSearchMode(false);
        setSearchQuery("");
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
      if (key.escape || input === "q") {
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
        const matchedOpIndex = operations.findIndex(
          (op) => op.shortcut === input,
        );
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
    } else if (
      (input === "n" || key.rightArrow) &&
      !isNavigating.current &&
      currentPage < totalPages - 1
    ) {
      setCurrentPage(currentPage + 1);
      setSelectedIndex(0);
    } else if (
      (input === "p" || key.leftArrow) &&
      !isNavigating.current &&
      currentPage > 0
    ) {
      setCurrentPage(currentPage - 1);
      setSelectedIndex(0);
    } else if (key.return) {
      console.clear();
      setShowDetails(true);
    } else if (input === "a") {
      console.clear();
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "c") {
      console.clear();
      setShowCreate(true);
    } else if (input === "o" && selectedDevbox) {
      // Open in browser
      const url = getDevboxUrl(selectedDevbox.id);
      const openBrowser = async () => {
        const { exec } = await import("child_process");
        const platform = process.platform;

        let openCommand: string;
        if (platform === "darwin") {
          openCommand = `open "${url}"`;
        } else if (platform === "win32") {
          openCommand = `start "${url}"`;
        } else {
          openCommand = `xdg-open "${url}"`;
        }

        exec(openCommand);
      };
      openBrowser();
    } else if (input === "/") {
      setSearchMode(true);
    } else if (key.escape) {
      if (searchQuery) {
        // Clear search when Esc is pressed and there's an active search
        setSearchQuery("");
        setCurrentPage(0);
        setSelectedIndex(0);
      } else {
        // Go back to home
        if (onBack) {
          onBack();
        } else if (onExit) {
          onExit();
        } else {
          inkExit();
        }
      }
    }
  });

  // No client-side filtering - search is handled server-side
  const currentDevboxes = devboxes;

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
  const operations = selectedDevbox
    ? allOperations.filter((op) => {
        const status = selectedDevbox.status;

        // When suspended: logs and resume
        if (status === "suspended") {
          return op.key === "resume" || op.key === "logs";
        }

        // When not running (shutdown, failure, etc): only logs
        if (
          status !== "running" &&
          status !== "provisioning" &&
          status !== "initializing"
        ) {
          return op.key === "logs";
        }

        // When running: everything except resume
        if (status === "running") {
          return op.key !== "resume";
        }

        // Default for transitional states (provisioning, initializing)
        return op.key === "logs" || op.key === "delete";
      })
    : allOperations;

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
      <ResourceActionsMenu
        resourceType="devbox"
        resource={selectedDevbox}
        onBack={() => {
          setShowActions(false);
          setSelectedOperation(0);
        }}
        breadcrumbItems={[
          { label: "Devboxes" },
          { label: selectedDevbox.name || selectedDevbox.id, active: true },
        ]}
        initialOperation={selectedOp?.key}
        skipOperationsMenu={true}
        onSSHRequest={onSSHRequest}
      />
    );
  }

  // Details view
  if (showDetails && selectedDevbox) {
    return (
      <DevboxDetailPage
        devbox={selectedDevbox}
        onBack={() => setShowDetails(false)}
        onSSHRequest={onSSHRequest}
      />
    );
  }

  // Show popup with table in background
  if (showPopup && selectedDevbox) {
    return (
      <>
        <Breadcrumb items={[{ label: "Devboxes", active: true }]} />
        {!initialLoading && !error && devboxes.length > 0 && (
          <>
            <Table
              data={currentDevboxes}
              keyExtractor={(devbox: any) => devbox.id}
              selectedIndex={selectedIndex}
              title={`devboxes[${totalCount}]`}
              columns={[
                {
                  key: "statusIcon",
                  label: "",
                  width: statusIconWidth,
                  render: (devbox: any, index: number, isSelected: boolean) => {
                    const statusDisplay = getStatusDisplay(devbox.status);

                    return (
                      <Text
                        color={isSelected ? "white" : statusDisplay.color}
                        bold={true}
                        inverse={isSelected}
                        wrap="truncate"
                      >
                        {statusDisplay.icon}{" "}
                      </Text>
                    );
                  },
                },
                createTextColumn("id", "ID", (devbox: any) => devbox.id, {
                  width: idWidth,
                  color: colors.textDim,
                  dimColor: false,
                  bold: false,
                }),
                {
                  key: "statusText",
                  label: "Status",
                  width: statusTextWidth,
                  render: (devbox: any, index: number, isSelected: boolean) => {
                    const statusDisplay = getStatusDisplay(devbox.status);

                    const truncated = statusDisplay.text.slice(
                      0,
                      statusTextWidth,
                    );
                    const padded = truncated.padEnd(statusTextWidth, " ");

                    return (
                      <Text
                        color={isSelected ? "white" : statusDisplay.color}
                        bold={true}
                        inverse={isSelected}
                        wrap="truncate"
                      >
                        {padded}
                      </Text>
                    );
                  },
                },
                createTextColumn(
                  "name",
                  "Name",
                  (devbox: any) => devbox.name || "",
                  {
                    width: nameWidth,
                    dimColor: false,
                  },
                ),
                createTextColumn(
                  "capabilities",
                  "Capabilities",
                  (devbox: any) => {
                    const hasCapabilities =
                      devbox.capabilities &&
                      devbox.capabilities.filter((c: string) => c !== "unknown")
                        .length > 0;
                    return hasCapabilities
                      ? `[${devbox.capabilities
                          .filter((c: string) => c !== "unknown")
                          .map((c: string) =>
                            c === "computer_usage"
                              ? "comp"
                              : c === "browser_usage"
                                ? "browser"
                                : c === "docker_in_docker"
                                  ? "docker"
                                  : c,
                          )
                          .join(",")}]`
                      : "";
                  },
                  {
                    width: capabilitiesWidth,
                    color: colors.info,
                    dimColor: false,
                    bold: false,
                    visible: showCapabilities,
                  },
                ),
                createTextColumn(
                  "source",
                  "Source",
                  (devbox: any) =>
                    devbox.blueprint_id
                      ? devbox.blueprint_id
                      : devbox.snapshot_id
                        ? devbox.snapshot_id
                        : "",
                  {
                    width: sourceWidth,
                    color: colors.info,
                    dimColor: false,
                    bold: false,
                    visible: showSource,
                  },
                ),
                createTextColumn(
                  "created",
                  "Created",
                  (devbox: any) =>
                    devbox.create_time_ms
                      ? formatTimeAgo(devbox.create_time_ms)
                      : "",
                  {
                    width: timeWidth,
                    color: colors.textDim,
                    dimColor: false,
                    bold: false,
                  },
                ),
              ]}
            />
          </>
        )}

        {/* Popup overlaying - use negative margin to pull it up over the table */}
        <Box
          marginTop={-Math.min(operations.length + 10, PAGE_SIZE + 5)}
          justifyContent="center"
        >
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

  // If initial loading or error, show that first
  if (initialLoading) {
    return (
      <>
        <Breadcrumb items={[{ label: "Devboxes", active: true }]} />
        <SpinnerComponent message="Loading..." />
      </>
    );
  }

  if (error) {
    return (
      <>
        <Breadcrumb items={[{ label: "Devboxes", active: true }]} />
        <ErrorMessage message="Failed to list devboxes" error={error} />
      </>
    );
  }

  // List view with data (always show, even if empty)
  return (
    <>
      <Breadcrumb items={[{ label: "Devboxes", active: true }]} />
      {currentDevboxes && currentDevboxes.length >= 0 && (
        <>
          {searchMode && (
            <Box marginBottom={1}>
              <Text color={colors.primary}>
                {figures.pointerSmall} Search:{" "}
              </Text>
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
              <Text color={colors.textDim} dimColor>
                {" "}
                [Esc to cancel]
              </Text>
            </Box>
          )}
          {!searchMode && searchQuery && (
            <Box marginBottom={1}>
              <Text color={colors.primary}>{figures.info} Searching for: </Text>
              <Text color={colors.warning} bold>
                {searchQuery}
              </Text>
              <Text color={colors.textDim} dimColor>
                {" "}
                ({totalCount} results) [/ to edit, Esc to clear]
              </Text>
            </Box>
          )}
          <Table
            key={`table-${searchQuery}-${currentPage}`}
            data={currentDevboxes}
            keyExtractor={(devbox: any) => devbox.id}
            selectedIndex={selectedIndex}
            title={`devboxes[${totalCount}]`}
            columns={[
              {
                key: "statusIcon",
                label: "",
                width: statusIconWidth,
                render: (devbox: any, index: number, isSelected: boolean) => {
                  const statusDisplay = getStatusDisplay(devbox.status);

                  return (
                    <Text
                      color={isSelected ? "white" : statusDisplay.color}
                      bold={true}
                      inverse={isSelected}
                      wrap="truncate"
                    >
                      {statusDisplay.icon}{" "}
                    </Text>
                  );
                },
              },
              createTextColumn("id", "ID", (devbox: any) => devbox.id, {
                width: idWidth,
                color: colors.textDim,
                dimColor: false,
                bold: false,
              }),
              {
                key: "statusText",
                label: "Status",
                width: statusTextWidth,
                render: (devbox: any, index: number, isSelected: boolean) => {
                  const statusDisplay = getStatusDisplay(devbox.status);

                  const truncated = statusDisplay.text.slice(
                    0,
                    statusTextWidth,
                  );
                  const padded = truncated.padEnd(statusTextWidth, " ");

                  return (
                    <Text
                      color={isSelected ? "white" : statusDisplay.color}
                      bold={true}
                      inverse={isSelected}
                      wrap="truncate"
                    >
                      {padded}
                    </Text>
                  );
                },
              },
              createTextColumn(
                "name",
                "Name",
                (devbox: any) => devbox.name || "",
                {
                  width: nameWidth,
                },
              ),
              createTextColumn(
                "capabilities",
                "Capabilities",
                (devbox: any) => {
                  const hasCapabilities =
                    devbox.capabilities &&
                    devbox.capabilities.filter((c: string) => c !== "unknown")
                      .length > 0;
                  return hasCapabilities
                    ? `[${devbox.capabilities
                        .filter((c: string) => c !== "unknown")
                        .map((c: string) =>
                          c === "computer_usage"
                            ? "comp"
                            : c === "browser_usage"
                              ? "browser"
                              : c === "docker_in_docker"
                                ? "docker"
                                : c,
                        )
                        .join(",")}]`
                    : "";
                },
                {
                  width: capabilitiesWidth,
                  color: colors.info,
                  dimColor: false,
                  bold: false,
                  visible: showCapabilities,
                },
              ),
              createTextColumn(
                "source",
                "Source",
                (devbox: any) =>
                  devbox.blueprint_id
                    ? devbox.blueprint_id
                    : devbox.snapshot_id
                      ? devbox.snapshot_id
                      : "",
                {
                  width: sourceWidth,
                  color: colors.info,
                  dimColor: false,
                  bold: false,
                  visible: showSource,
                },
              ),
              createTextColumn(
                "created",
                "Created",
                (devbox: any) =>
                  devbox.create_time_ms
                    ? formatTimeAgo(devbox.create_time_ms)
                    : "",
                {
                  width: timeWidth,
                  color: colors.textDim,
                  dimColor: false,
                  bold: false,
                },
              ),
            ]}
          />

          {/* Statistics Bar */}
          <Box marginTop={1} paddingX={1}>
            <Text color={colors.primary} bold>
              {figures.hamburger} {totalCount}
            </Text>
            <Text color={colors.textDim} dimColor>
              {" "}
              total
            </Text>
            {totalPages > 1 && (
              <>
                <Text color={colors.textDim} dimColor>
                  {" "}
                  •{" "}
                </Text>
                <Text color={colors.textDim} dimColor>
                  Page {currentPage + 1} of {totalPages}
                </Text>
              </>
            )}
            <Text color={colors.textDim} dimColor>
              {" "}
              •{" "}
            </Text>
            <Text color={colors.textDim} dimColor>
              Showing {startIndex + 1}-{endIndex} of {totalCount}
            </Text>
            {hasMore && (
              <Text color={colors.textDim} dimColor>
                {" "}
                (more available)
              </Text>
            )}
            <Text> </Text>
            {refreshing ? (
              <Text color={colors.primary}>
                {
                  ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"][
                    refreshIcon % 10
                  ]
                }
              </Text>
            ) : (
              <Text color={colors.success}>{figures.circleFilled}</Text>
            )}
          </Box>

          {/* Help Bar */}
          <Box marginTop={1} paddingX={1}>
            <Text color={colors.textDim} dimColor>
              {figures.arrowUp}
              {figures.arrowDown} Navigate
            </Text>
            {totalPages > 1 && (
              <Text color={colors.textDim} dimColor>
                {" "}
                • {figures.arrowLeft}
                {figures.arrowRight} Page
              </Text>
            )}
            <Text color={colors.textDim} dimColor>
              {" "}
              • [Enter] Details • [a] Actions • [c] Create • [/] Search • [o]
              Browser • [Esc] Back
            </Text>
          </Box>
        </>
      )}
    </>
  );
};

// Export the UI component for use in the main menu
export { ListDevboxesUI };

export async function listDevboxes(
  options: ListOptions,
  focusDevboxId?: string,
) {
  const executor = createExecutor(options);

  let sshSessionConfig: SSHSessionConfig | null = null;

  await executor.executeList(
    async () => {
      const client = executor.getClient();
      return executor.fetchFromIterator(client.devboxes.list(), {
        filter: options.status
          ? (devbox: any) => devbox.status === options.status
          : undefined,
        limit: DEFAULT_PAGE_SIZE,
      });
    },
    () => (
      <ListDevboxesUI
        status={options.status}
        focusDevboxId={focusDevboxId}
        onSSHRequest={(config) => {
          sshSessionConfig = config;
        }}
      />
    ),
    DEFAULT_PAGE_SIZE,
  );

  // If SSH was requested, handle it now after Ink has exited
  if (sshSessionConfig) {
    const result = await runSSHSession(sshSessionConfig);

    if (result.shouldRestart) {
      console.clear();
      console.log(`\nSSH session ended. Returning to CLI...\n`);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Restart the list view with the devbox ID to focus on
      await listDevboxes(options, result.returnToDevboxId);
    } else {
      process.exit(result.exitCode);
    }
  }
}

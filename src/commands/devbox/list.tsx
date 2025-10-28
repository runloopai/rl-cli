import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import type { DevboxesCursorIDPage } from "@runloop/api-client/pagination";
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
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
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
const MAX_CACHE_SIZE = 10; // Limit cache to 10 pages to prevent memory leaks

const ListDevboxesUI: React.FC<{
  status?: string;
  onSSHRequest?: (config: SSHSessionConfig) => void;
  focusDevboxId?: string;
  onBack?: () => void;
  onExit?: () => void;
}> = ({ status, onSSHRequest, focusDevboxId, onBack, onExit }) => {
  const { exit: inkExit } = useApp();
  const [initialLoading, setInitialLoading] = React.useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [devboxes, setDevboxes] = React.useState<any[]>([]);
  const [error, setError] = React.useState<Error | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showDetails, setShowDetails] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [showActions, setShowActions] = React.useState(false);
  const [showPopup, setShowPopup] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);
  const isNavigating = React.useRef(false);
  const [searchMode, setSearchMode] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [totalCount, setTotalCount] = React.useState(0);
  const [hasMore, setHasMore] = React.useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageCache = React.useRef<Map<number, any[]>>(new Map());
  const lastIdCache = React.useRef<Map<number, string>>(new Map());

  // Calculate overhead for viewport height:
  // - Breadcrumb (3 lines + marginBottom): 4 lines
  // - Search bar (if visible, 1 line + marginBottom): 2 lines
  // - Table (title + top border + header + bottom border): 4 lines
  // - Stats bar (marginTop + content): 2 lines
  // - Help bar (marginTop + content): 2 lines
  // - Safety buffer for edge cases: 1 line
  // Total: 13 lines base + 2 if searching
  const overhead = 13 + (searchMode || searchQuery ? 2 : 0);
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  const PAGE_SIZE = viewportHeight;

  const fixedWidth = 4; // pointer + spaces
  const statusIconWidth = 2;
  const statusTextWidth = 10;
  const timeWidth = 20;
  const capabilitiesWidth = 18;
  const sourceWidth = 26;

  // ID is always full width (25 chars for dbx_31CYd5LLFbBxst8mqnUjO format)
  const idWidth = 26;

  // Responsive layout based on terminal width (simplified like blueprint list)
  const showCapabilities = terminalWidth >= 140;
  const showSource = terminalWidth >= 120;

  // CRITICAL: Absolute maximum column widths to prevent Yoga crashes
  // These caps apply regardless of terminal size to prevent padEnd() from creating massive strings
  const ABSOLUTE_MAX_NAME_WIDTH = 80;

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
    nameWidth = Math.min(ABSOLUTE_MAX_NAME_WIDTH, Math.max(15, remainingWidth));
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
    nameWidth = Math.min(ABSOLUTE_MAX_NAME_WIDTH, Math.max(12, remainingWidth));
  } else {
    const remainingWidth =
      terminalWidth -
      fixedWidth -
      statusIconWidth -
      idWidth -
      statusTextWidth -
      timeWidth -
      10;
    nameWidth = Math.min(ABSOLUTE_MAX_NAME_WIDTH, Math.max(8, remainingWidth));
  }

  // Build responsive column list (memoized to prevent recreating on every render)
  const tableColumns = React.useMemo(() => {
    // CRITICAL: Absolute max lengths to prevent Yoga crashes on repeated mounts
    // Yoga layout engine cannot handle strings longer than ~100 chars reliably
    const ABSOLUTE_MAX_NAME = 80;
    const ABSOLUTE_MAX_ID = 50;

    const columns = [
      createTextColumn(
        "name",
        "Name",
        (devbox: any) => {
          const name = String(devbox?.name || devbox?.id || "");
          // Use absolute minimum to prevent Yoga crashes
          const safeMax = Math.min(nameWidth || 15, ABSOLUTE_MAX_NAME);
          return name.length > safeMax
            ? name.substring(0, Math.max(1, safeMax - 3)) + "..."
            : name;
        },
        {
          width: Math.min(nameWidth || 15, ABSOLUTE_MAX_NAME),
          dimColor: false,
        },
      ),
      createTextColumn(
        "id",
        "ID",
        (devbox: any) => {
          const id = String(devbox?.id || "");
          // Use absolute minimum to prevent Yoga crashes
          const safeMax = Math.min(idWidth || 26, ABSOLUTE_MAX_ID);
          return id.length > safeMax
            ? id.substring(0, Math.max(1, safeMax - 3)) + "..."
            : id;
        },
        {
          width: Math.min(idWidth || 26, ABSOLUTE_MAX_ID),
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
      createTextColumn(
        "status",
        "Status",
        (devbox: any) => {
          const statusDisplay = getStatusDisplay(devbox?.status);
          const text = String(statusDisplay?.text || "-");
          // Cap status text to absolute maximum
          return text.length > 20 ? text.substring(0, 17) + "..." : text;
        },
        {
          width: statusTextWidth,
          dimColor: false,
        },
      ),
      createTextColumn(
        "created",
        "Created",
        (devbox: any) => {
          const time = formatTimeAgo(devbox?.create_time_ms || Date.now());
          const text = String(time || "-");
          // Cap time text to absolute maximum
          return text.length > 25 ? text.substring(0, 22) + "..." : text;
        },
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
        },
      ),
    ];

    // Add optional columns based on terminal width
    if (showSource) {
      columns.push(
        createTextColumn(
          "source",
          "Source",
          (devbox: any) => {
            if (devbox?.blueprint_id) {
              const bpId = String(devbox.blueprint_id);
              const truncated = bpId.slice(0, 10);
              const text = `blueprint:${truncated}`;
              // Cap source text to absolute maximum
              return text.length > 30 ? text.substring(0, 27) + "..." : text;
            }
            return "-";
          },
          {
            width: sourceWidth,
            color: colors.textDim,
            dimColor: false,
          },
        ),
      );
    }

    if (showCapabilities) {
      columns.push(
        createTextColumn(
          "capabilities",
          "Capabilities",
          (devbox: any) => {
            const caps = [];
            if (devbox?.entitlements?.network_enabled) caps.push("net");
            if (devbox?.entitlements?.gpu_enabled) caps.push("gpu");
            const text = caps.length > 0 ? caps.join(",") : "-";
            // Cap capabilities text to absolute maximum
            return text.length > 20 ? text.substring(0, 17) + "..." : text;
          },
          {
            width: capabilitiesWidth,
            color: colors.textDim,
            dimColor: false,
          },
        ),
      );
    }

    return columns;
  }, [
    nameWidth,
    idWidth,
    statusTextWidth,
    timeWidth,
    showSource,
    sourceWidth,
    showCapabilities,
    capabilitiesWidth,
  ]);

  // Define allOperations (memoized to prevent recreating on every render)
  const allOperations = React.useMemo(
    () => [
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
    ],
    [],
  );

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

  // Track previous PAGE_SIZE to detect changes
  const prevPageSize = React.useRef<number | undefined>(undefined);

  // Clear cache when PAGE_SIZE changes (e.g., when search UI appears/disappears)
  React.useEffect(() => {
    // Only clear cache if PAGE_SIZE actually changed and not initial mount
    if (
      prevPageSize.current !== undefined &&
      prevPageSize.current !== PAGE_SIZE &&
      !initialLoading
    ) {
      pageCache.current.clear();
      lastIdCache.current.clear();
      // Reset to page 0 to avoid out of bounds
      setCurrentPage(0);
      setSelectedIndex(0);
    }
    prevPageSize.current = PAGE_SIZE;
  }, [PAGE_SIZE, initialLoading]);

  // Cleanup: Clear cache on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      pageCache.current.clear();
      lastIdCache.current.clear();
    };
  }, []);

  React.useEffect(() => {
    let isMounted = true; // Track if component is still mounted

    const list = async (
      isInitialLoad: boolean = false,
      isBackgroundRefresh: boolean = false,
    ) => {
      try {
        // Set navigating flag at the start (but not for background refresh)
        if (!isBackgroundRefresh) {
          isNavigating.current = true;
        }

        // Check if we have cached data for this page
        if (
          !isInitialLoad &&
          !isBackgroundRefresh &&
          pageCache.current.has(currentPage)
        ) {
          if (isMounted) {
            setDevboxes(pageCache.current.get(currentPage) || []);
          }
          isNavigating.current = false;
          return;
        }

        const client = getClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pageDevboxes: any[] = [];

        // Get starting_after cursor from previous page's last ID
        const startingAfter =
          currentPage > 0
            ? lastIdCache.current.get(currentPage - 1)
            : undefined;

        // Build query params (using any to avoid complex type imports)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const queryParams: any = {
          limit: PAGE_SIZE,
        };
        if (startingAfter) {
          queryParams.starting_after = startingAfter;
        }
        if (status) {
          queryParams.status = status;
        }
        if (searchQuery) {
          queryParams.search = searchQuery;
        }

        // CRITICAL: Fetch ONLY ONE page, never auto-paginate
        // The SDK will return a Page object, but we MUST NOT iterate it
        // The limit parameter ensures we only request PAGE_SIZE items
        const pagePromise = client.devboxes.list(queryParams);

        // Await the promise to get the Page object
        // DO NOT use for-await or iterate - that triggers auto-pagination
        let page = (await pagePromise) as DevboxesCursorIDPage<{
          id: string;
        }>;

        // Extract data immediately and create defensive copies
        // This breaks all reference chains to the SDK's internal objects
        if (page.devboxes && Array.isArray(page.devboxes)) {
          // Copy ONLY the fields we need - don't hold entire SDK objects
          page.devboxes.forEach((d: any) => {
            pageDevboxes.push({
              id: d.id,
              name: d.name,
              status: d.status,
              create_time_ms: d.create_time_ms,
              blueprint_id: d.blueprint_id,
              entitlements: d.entitlements ? { ...d.entitlements } : undefined,
            });
          });
        } else {
          console.error(
            "Unable to access devboxes from page. Available keys:",
            Object.keys(page || {}),
          );
        }

        // Extract metadata before releasing page reference
        const totalCount = page.total_count || pageDevboxes.length;
        const hasMore = page.has_more || false;

        // CRITICAL: Explicitly null out page reference to help GC
        // The Page object holds references to client, response, and options
        page = null as any;

        // Only update state if component is still mounted
        if (!isMounted) return;

        // Update pagination metadata
        setTotalCount(totalCount);
        setHasMore(hasMore);

        // Cache the page data and last ID
        if (pageDevboxes.length > 0) {
          // Implement LRU cache eviction: if cache is full, remove oldest entry
          if (pageCache.current.size >= MAX_CACHE_SIZE) {
            const firstKey = pageCache.current.keys().next().value;
            if (firstKey !== undefined) {
              pageCache.current.delete(firstKey);
              lastIdCache.current.delete(firstKey);
            }
          }
          pageCache.current.set(currentPage, pageDevboxes);
          lastIdCache.current.set(
            currentPage,
            pageDevboxes[pageDevboxes.length - 1].id,
          );
        }

        // Update devboxes for current page
        // React will handle efficient re-rendering - no need for manual comparison
        setDevboxes(pageDevboxes);
      } catch (err) {
        if (isMounted) {
          setError(err as Error);
        }
      } finally {
        if (!isBackgroundRefresh) {
          isNavigating.current = false;
        }
        // Only set initialLoading to false after first successful load
        if (isInitialLoad && isMounted) {
          setInitialLoading(false);
        }
      }
    };

    // Only treat as initial load on first mount
    const isFirstMount = initialLoading;
    list(isFirstMount, false);

    // Cleanup: Cancel any pending state updates when component unmounts
    return () => {
      isMounted = false;
    };

    // DISABLED: Polling causes flashing in non-tmux terminals
    // Users can manually refresh by navigating away and back
    // const interval = setInterval(() => {
    //   if (
    //     !showDetails &&
    //     !showCreate &&
    //     !showActions &&
    //     !isNavigating.current
    //   ) {
    //     list(false, true);
    //   }
    // }, 3000);
    // return () => clearInterval(interval);
  }, [
    showDetails,
    showCreate,
    showActions,
    currentPage,
    searchQuery,
    PAGE_SIZE,
    status,
  ]);

  // Removed refresh icon animation to prevent constant re-renders and flashing

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
        if (searchQuery) {
          // If there was a query, clear it and refresh
          setSearchQuery("");
          setCurrentPage(0);
          setSelectedIndex(0);
          pageCache.current.clear();
          lastIdCache.current.clear();
        }
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
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (key.upArrow && selectedOperation > 0) {
        setSelectedOperation(selectedOperation - 1);
      } else if (key.downArrow && selectedOperation < operations.length - 1) {
        setSelectedOperation(selectedOperation + 1);
      } else if (key.return) {
        // Execute the selected operation
        setShowPopup(false);
        setShowActions(true);
      } else if (input) {
        // Check for shortcut match
        const matchedOpIndex = operations.findIndex(
          (op) => op.shortcut === input,
        );
        if (matchedOpIndex !== -1) {
          setSelectedOperation(matchedOpIndex);
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
      setShowDetails(true);
    } else if (input === "a") {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "c") {
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
        pageCache.current.clear();
        lastIdCache.current.clear();
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

  // Filter operations based on devbox status (inline like blueprints)
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

  // CRITICAL: Aggressive memory cleanup when switching views to prevent heap exhaustion
  React.useEffect(() => {
    if (showDetails || showActions || showCreate) {
      // Immediately clear list data when navigating away to free memory
      setDevboxes([]);
    }
  }, [showDetails, showActions, showCreate]);

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

  // Main list view
  return (
    <>
      <Breadcrumb items={[{ label: "Devboxes", active: true }]} />

      {/* Search bar */}
      {searchMode && (
        <Box marginBottom={1}>
          <Text color={colors.primary}>{figures.pointerSmall} Search: </Text>
          <TextInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Type to search..."
            onSubmit={() => {
              setSearchMode(false);
              setCurrentPage(0);
              setSelectedIndex(0);
              pageCache.current.clear();
              lastIdCache.current.clear();
            }}
          />
          <Text color={colors.textDim} dimColor>
            {" "}
            [Enter to search, Esc to cancel]
          </Text>
        </Box>
      )}
      {!searchMode && searchQuery && (
        <Box marginBottom={1}>
          <Text color={colors.primary}>{figures.info} Searching for: </Text>
          <Text color={colors.warning} bold>
            {searchQuery.length > 50
              ? searchQuery.substring(0, 50) + "..."
              : searchQuery}
          </Text>
          <Text color={colors.textDim} dimColor>
            {" "}
            ({totalCount} results) [/ to edit, Esc to clear]
          </Text>
        </Box>
      )}

      {/* Table - hide when popup is shown */}
      {!showPopup && (
        <Table
          data={currentDevboxes}
          keyExtractor={(devbox: any) => devbox.id}
          selectedIndex={selectedIndex}
          title="devboxes"
          columns={tableColumns}
        />
      )}

      {/* Statistics Bar - hide when popup is shown */}
      {!showPopup && (
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
          {searchQuery && (
            <>
              <Text color={colors.textDim} dimColor>
                {" "}
                •{" "}
              </Text>
              <Text color={colors.warning}>
                Filtered: &quot;{searchQuery}&quot;
              </Text>
            </>
          )}
        </Box>
      )}

      {/* Actions Popup - show inline when triggered */}
      {showPopup && selectedDevbox && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedDevbox}
            operations={operations}
            selectedOperation={selectedOperation}
            onClose={() => setShowPopup(false)}
          />
        </Box>
      )}

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
          • [Enter] Details
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          • [a] Actions
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          • [c] Create
        </Text>
        {selectedDevbox && (
          <Text color={colors.textDim} dimColor>
            {" "}
            • [o] Open in Browser
          </Text>
        )}
        <Text color={colors.textDim} dimColor>
          {" "}
          • [/] Search
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          • [Esc] Back
        </Text>
      </Box>
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
      console.log(`\nSSH session ended. Returning to CLI...\n`);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Restart the list view with the devbox ID to focus on
      await listDevboxes(options, result.returnToDevboxId);
    } else {
      process.exit(result.exitCode);
    }
  }
}

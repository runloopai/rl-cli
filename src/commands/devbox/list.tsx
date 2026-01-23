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
import { NavigationTips } from "../../components/NavigationTips.js";
import type { Column } from "../../components/Table.js";
import { Table, createTextColumn } from "../../components/Table.js";
import { formatTimeAgo } from "../../components/ResourceListView.js";
import { output, outputError } from "../../utils/output.js";
import { DevboxDetailPage } from "../../components/DevboxDetailPage.js";
import { DevboxCreatePage } from "../../components/DevboxCreatePage.js";
import { ResourceActionsMenu } from "../../components/ResourceActionsMenu.js";
import { ActionsPopup } from "../../components/ActionsPopup.js";
import { getDevboxUrl } from "../../utils/url.js";
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../../hooks/useExitOnCtrlC.js";
import { useCursorPagination } from "../../hooks/useCursorPagination.js";
import { colors } from "../../utils/theme.js";
import { useDevboxStore, type Devbox } from "../../store/devboxStore.js";

interface ListOptions {
  status?: string;
  limit?: string;
  output?: string;
}

const DEFAULT_PAGE_SIZE = 10;

const ListDevboxesUI = ({
  status,
  onBack,
  onExit,
  onNavigateToDetail,
}: {
  status?: string;
  onBack?: () => void;
  onExit?: () => void;
  onNavigateToDetail?: (devboxId: string) => void;
}) => {
  const { exit: inkExit } = useApp();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showDetails, setShowDetails] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [showActions, setShowActions] = React.useState(false);
  const [showPopup, setShowPopup] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);
  const [searchMode, setSearchMode] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [submittedSearchQuery, setSubmittedSearchQuery] = React.useState("");

  // Get devbox store setter to sync data for detail screen
  const setDevboxesInStore = useDevboxStore((state) => state.setDevboxes);

  // Calculate overhead for viewport height:
  // - Breadcrumb (3 lines + marginBottom): 4 lines
  // - Search bar (if visible, 1 line + marginBottom): 2 lines
  // - Table (title + top border + header + bottom border): 4 lines
  // - Stats bar (marginTop + content): 2 lines
  // - Help bar (marginTop + content): 2 lines
  // - Safety buffer for edge cases: 1 line
  // Total: 13 lines base + 2 if searching
  const overhead = 13 + (searchMode || submittedSearchQuery ? 2 : 0);
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  const PAGE_SIZE = viewportHeight;

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const client = getClient();
      const pageDevboxes: Devbox[] = [];

      // Build query params
      const queryParams: Record<string, unknown> = {
        limit: params.limit,
      };
      if (params.startingAt) {
        queryParams.starting_after = params.startingAt;
      }
      if (status) {
        queryParams.status = status;
      }
      if (submittedSearchQuery) {
        queryParams.search = submittedSearchQuery;
      }

      // Fetch ONE page only
      const page = (await client.devboxes.list(
        queryParams,
      )) as unknown as DevboxesCursorIDPage<Devbox>;

      // Extract data and create defensive copies using JSON serialization
      if (page.devboxes && Array.isArray(page.devboxes)) {
        page.devboxes.forEach((d: Devbox) => {
          pageDevboxes.push(JSON.parse(JSON.stringify(d)) as Devbox);
        });
      }

      const result = {
        items: pageDevboxes,
        hasMore: page.has_more || false,
        totalCount: page.total_count || pageDevboxes.length,
      };

      return result;
    },
    [status, submittedSearchQuery],
  );

  // Use the shared pagination hook
  const {
    items: devboxes,
    loading,
    navigating,
    error,
    currentPage,
    hasMore,
    hasPrev,
    totalCount,
    nextPage,
    prevPage,
  } = useCursorPagination({
    fetchPage,
    pageSize: PAGE_SIZE,
    getItemId: (devbox: Devbox) => devbox.id,
    pollInterval: 2000,
    pollingEnabled:
      !showDetails && !showCreate && !showActions && !showPopup && !searchMode,
    deps: [status, submittedSearchQuery, PAGE_SIZE],
  });

  // Sync devboxes to store for detail screen
  React.useEffect(() => {
    if (devboxes.length > 0) {
      setDevboxesInStore(devboxes);
    }
  }, [devboxes, setDevboxesInStore]);

  const fixedWidth = 4; // pointer + spaces
  const statusIconWidth = 2;
  const statusTextWidth = 10;
  const timeWidth = 20;
  const capabilitiesWidth = 18;
  const sourceWidth = 26;

  // ID is always full width (25 chars for dbx_31CYd5LLFbBxst8mqnUjO format)
  const idWidth = 26;

  // Responsive layout - hide less important columns on smaller screens
  // Priority (most to least important): ID, Name, Status, Created, Source, Capabilities
  const showCapabilities = terminalWidth >= 160;
  const showSource = terminalWidth >= 135;
  const showCreated = terminalWidth >= 100;

  // CRITICAL: Absolute maximum column widths to prevent Yoga crashes
  const ABSOLUTE_MAX_NAME_WIDTH = 80;

  // Name width is flexible and uses remaining space
  // Only subtract widths of columns that are actually shown
  const baseWidth =
    fixedWidth +
    statusIconWidth +
    idWidth +
    statusTextWidth +
    (showCreated ? timeWidth : 0) +
    6; // border + padding
  const optionalWidth =
    (showSource ? sourceWidth : 0) + (showCapabilities ? capabilitiesWidth : 0);
  const remainingWidth = terminalWidth - baseWidth - optionalWidth;
  const nameWidth = Math.min(
    ABSOLUTE_MAX_NAME_WIDTH,
    Math.max(15, remainingWidth),
  );

  // Build responsive column list (memoized to prevent recreating on every render)
  const tableColumns = React.useMemo(() => {
    const ABSOLUTE_MAX_NAME = 80;
    const ABSOLUTE_MAX_ID = 50;

    const columns: Column<Devbox>[] = [
      // Status icon column - visual indicator for quick scanning
      {
        key: "statusIcon",
        label: "",
        width: statusIconWidth,
        render: (devbox: Devbox, _index: number, isSelected: boolean) => {
          const statusDisplay = getStatusDisplay(devbox?.status);
          return (
            <Text
              color={isSelected ? "white" : statusDisplay.color}
              bold={true}
              dimColor={false}
              inverse={isSelected}
              wrap="truncate"
            >
              {statusDisplay.icon}{" "}
            </Text>
          );
        },
      },
      createTextColumn(
        "id",
        "ID",
        (devbox: Devbox) => {
          const id = String(devbox?.id || "");
          const safeMax = Math.min(idWidth || 26, ABSOLUTE_MAX_ID);
          return id.length > safeMax
            ? id.substring(0, Math.max(1, safeMax - 3)) + "..."
            : id;
        },
        {
          width: Math.min(idWidth || 26, ABSOLUTE_MAX_ID),
          color: colors.idColor,
          dimColor: false,
          bold: false,
        },
      ),
      createTextColumn(
        "name",
        "Name",
        (devbox: Devbox) => {
          const name = String(devbox?.name || "");
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
      // Status text column with color matching the icon
      {
        key: "status",
        label: "Status",
        width: statusTextWidth,
        render: (devbox: Devbox, _index: number, isSelected: boolean) => {
          const statusDisplay = getStatusDisplay(devbox?.status);
          const safeWidth = Math.max(1, statusTextWidth);
          const truncated = statusDisplay.text.slice(0, safeWidth);
          const padded = truncated.padEnd(safeWidth, " ");
          return (
            <Text
              color={isSelected ? "white" : statusDisplay.color}
              bold={true}
              dimColor={false}
              inverse={isSelected}
              wrap="truncate"
            >
              {padded}
            </Text>
          );
        },
      },
      createTextColumn(
        "created",
        "Created",
        (devbox: Devbox) => {
          const time = formatTimeAgo(devbox?.create_time_ms || Date.now());
          const text = String(time || "-");
          return text.length > 25 ? text.substring(0, 22) + "..." : text;
        },
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          visible: showCreated,
        },
      ),
    ];

    if (showSource) {
      columns.push(
        createTextColumn(
          "source",
          "Source",
          (devbox: Devbox) => devbox?.blueprint_id || "-",
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
          (devbox: Devbox) => {
            const caps = devbox?.capabilities || [];
            const text = caps.length > 0 ? caps.join(",") : "-";
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
    statusIconWidth,
    nameWidth,
    idWidth,
    statusTextWidth,
    timeWidth,
    showCreated,
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

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (devboxes.length > 0 && selectedIndex >= devboxes.length) {
      setSelectedIndex(Math.max(0, devboxes.length - 1));
    }
  }, [devboxes.length, selectedIndex]);

  const selectedDevbox = devboxes[selectedIndex];

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + devboxes.length;

  // Filter operations based on devbox status
  const operations = selectedDevbox
    ? allOperations.filter((op) => {
        const devboxStatus = selectedDevbox.status;

        if (devboxStatus === "suspended") {
          return op.key === "resume" || op.key === "logs";
        }

        if (
          devboxStatus !== "running" &&
          devboxStatus !== "provisioning" &&
          devboxStatus !== "initializing"
        ) {
          return op.key === "logs";
        }

        if (devboxStatus === "running") {
          return op.key !== "resume";
        }

        return op.key === "logs" || op.key === "delete";
      })
    : allOperations;

  useInput((input, key) => {
    const pageDevboxes = devboxes.length;

    // Skip input handling when in search mode - let TextInput handle it
    if (searchMode) {
      if (key.escape) {
        setSearchMode(false);
        setSearchQuery("");
      }
      return;
    }

    // Skip input handling when in details view
    if (showDetails) {
      return;
    }

    // Skip input handling when in create view
    if (showCreate) {
      return;
    }

    // Skip input handling when in actions view
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
        setShowPopup(false);
        setShowActions(true);
      } else if (input) {
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
      !loading &&
      !navigating &&
      hasMore
    ) {
      nextPage();
      setSelectedIndex(0);
    } else if (
      (input === "p" || key.leftArrow) &&
      !loading &&
      !navigating &&
      hasPrev
    ) {
      prevPage();
      setSelectedIndex(0);
    } else if (key.return) {
      if (onNavigateToDetail && selectedDevbox) {
        onNavigateToDetail(selectedDevbox.id);
      } else {
        setShowDetails(true);
      }
    } else if (input === "a") {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "c") {
      setShowCreate(true);
    } else if (input === "o" && selectedDevbox) {
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
      if (submittedSearchQuery) {
        setSubmittedSearchQuery("");
        setSearchQuery("");
        setSelectedIndex(0);
      } else {
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

  // Create view
  if (showCreate) {
    return (
      <DevboxCreatePage
        onBack={() => {
          setShowCreate(false);
        }}
        onCreate={(devbox) => {
          setShowCreate(false);
          // Navigate to the newly created devbox's detail page
          if (onNavigateToDetail) {
            onNavigateToDetail(devbox.id);
          }
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
      />
    );
  }

  // Details view
  if (showDetails && selectedDevbox) {
    return (
      <DevboxDetailPage
        devbox={selectedDevbox}
        onBack={() => setShowDetails(false)}
      />
    );
  }

  // Loading state (only on initial load)
  if (loading && devboxes.length === 0) {
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
              setSubmittedSearchQuery(searchQuery);
              setSelectedIndex(0);
            }}
          />
          <Text color={colors.textDim} dimColor>
            {" "}
            [Enter to search, Esc to cancel]
          </Text>
        </Box>
      )}
      {!searchMode && submittedSearchQuery && (
        <Box marginBottom={1}>
          <Text color={colors.primary}>{figures.info} Searching for: </Text>
          <Text color={colors.warning} bold>
            {submittedSearchQuery.length > 50
              ? submittedSearchQuery.substring(0, 50) + "..."
              : submittedSearchQuery}
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
          data={devboxes}
          keyExtractor={(devbox: Devbox) => devbox.id}
          selectedIndex={selectedIndex}
          title="devboxes"
          columns={tableColumns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No devboxes found. Press [c] to create one.
            </Text>
          }
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
              {navigating ? (
                <Text color={colors.warning}>
                  {figures.pointer} Loading page {currentPage + 1}...
                </Text>
              ) : (
                <Text color={colors.textDim} dimColor>
                  Page {currentPage + 1} of {totalPages}
                </Text>
              )}
            </>
          )}
          <Text color={colors.textDim} dimColor>
            {" "}
            •{" "}
          </Text>
          <Text color={colors.textDim} dimColor>
            Showing {startIndex + 1}-{endIndex} of {totalCount}
          </Text>
          {submittedSearchQuery && (
            <>
              <Text color={colors.textDim} dimColor>
                {" "}
                •{" "}
              </Text>
              <Text color={colors.warning}>
                Filtered: &quot;{submittedSearchQuery}&quot;
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
      <NavigationTips
        showArrows
        tips={[
          {
            icon: `${figures.arrowLeft}${figures.arrowRight}`,
            label: "Page",
            condition: hasMore || hasPrev,
          },
          { key: "Enter", label: "Details" },
          { key: "a", label: "Actions" },
          { key: "c", label: "Create" },
          { key: "o", label: "Open in Browser", condition: !!selectedDevbox },
          { key: "/", label: "Search" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
};

// Export the UI component for use in the main menu
export { ListDevboxesUI };

export async function listDevboxes(options: ListOptions) {
  try {
    const client = getClient();

    // Build query params
    const queryParams: Record<string, unknown> = {
      limit: options.limit ? parseInt(options.limit, 10) : DEFAULT_PAGE_SIZE,
    };
    if (options.status) {
      queryParams.status = options.status;
    }

    // Fetch devboxes
    const page = (await client.devboxes.list(
      queryParams,
    )) as DevboxesCursorIDPage<{ id: string }>;

    // Extract devboxes array
    const devboxes = page.devboxes || [];

    output(devboxes, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list devboxes", error);
  }
}

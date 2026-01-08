import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import type { DiskSnapshotsCursorIDPage } from "@runloop/api-client/pagination";
import { getClient } from "../../utils/client.js";
import { Header } from "../../components/Header.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { SuccessMessage } from "../../components/SuccessMessage.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";
import { Table, createTextColumn } from "../../components/Table.js";
import { ActionsPopup } from "../../components/ActionsPopup.js";
import { Operation } from "../../components/OperationsMenu.js";
import { formatTimeAgo } from "../../components/ResourceListView.js";
import { output, outputError } from "../../utils/output.js";
import { colors } from "../../utils/theme.js";
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../../hooks/useExitOnCtrlC.js";
import { useCursorPagination } from "../../hooks/useCursorPagination.js";
import { DevboxCreatePage } from "../../components/DevboxCreatePage.js";
import { useNavigation } from "../../store/navigationStore.js";

interface ListOptions {
  devbox?: string;
  output?: string;
}

// Local interface for snapshot data used in this component
interface SnapshotListItem {
  id: string;
  name?: string;
  status?: string;
  create_time_ms?: number;
  source_devbox_id?: string;
  [key: string]: unknown;
}

const DEFAULT_PAGE_SIZE = 10;

const ListSnapshotsUI = ({
  devboxId,
  onBack,
  onExit,
}: {
  devboxId?: string;
  onBack?: () => void;
  onExit?: () => void;
}) => {
  const { exit: inkExit } = useApp();
  const { navigate } = useNavigation();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showPopup, setShowPopup] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedSnapshot, setSelectedSnapshot] = React.useState<any | null>(
    null,
  );
  const [executingOperation, setExecutingOperation] = React.useState<
    string | null
  >(null);
  const [operationResult, setOperationResult] = React.useState<string | null>(
    null,
  );
  const [operationError, setOperationError] = React.useState<Error | null>(
    null,
  );
  const [operationLoading, setOperationLoading] = React.useState(false);
  const [showCreateDevbox, setShowCreateDevbox] = React.useState(false);

  // Calculate overhead for viewport height
  const overhead = 13;
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  const PAGE_SIZE = viewportHeight;

  // All width constants
  const idWidth = 25;
  const nameWidth = Math.max(15, terminalWidth >= 120 ? 30 : 25);
  const devboxWidth = 15;
  const timeWidth = 20;
  const showDevboxIdColumn = terminalWidth >= 100 && !devboxId;

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const client = getClient();
      const pageSnapshots: SnapshotListItem[] = [];

      // Build query params
      const queryParams: Record<string, unknown> = {
        limit: params.limit,
      };
      if (params.startingAt) {
        queryParams.starting_after = params.startingAt;
      }
      if (devboxId) {
        queryParams.devbox_id = devboxId;
      }

      // Fetch ONE page only
      const page = (await client.devboxes.listDiskSnapshots(
        queryParams,
      )) as unknown as DiskSnapshotsCursorIDPage<SnapshotListItem>;

      // Extract data and create defensive copies
      if (page.snapshots && Array.isArray(page.snapshots)) {
        page.snapshots.forEach((s: SnapshotListItem) => {
          pageSnapshots.push({
            id: s.id,
            name: s.name,
            status: s.status,
            create_time_ms: s.create_time_ms,
            source_devbox_id: s.source_devbox_id,
          });
        });
      }

      const result = {
        items: pageSnapshots,
        hasMore: page.has_more || false,
        totalCount: page.total_count || pageSnapshots.length,
      };

      return result;
    },
    [devboxId],
  );

  // Use the shared pagination hook
  const {
    items: snapshots,
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
    getItemId: (snapshot: SnapshotListItem) => snapshot.id,
    pollInterval: 2000,
    pollingEnabled: !showPopup && !executingOperation && !showCreateDevbox,
    deps: [devboxId, PAGE_SIZE],
  });

  // Operations for snapshots
  const operations: Operation[] = React.useMemo(
    () => [
      {
        key: "create_devbox",
        label: "Create Devbox from Snapshot",
        color: colors.success,
        icon: figures.play,
      },
      {
        key: "delete",
        label: "Delete Snapshot",
        color: colors.error,
        icon: figures.cross,
      },
    ],
    [],
  );

  // Build columns
  const columns = React.useMemo(
    () => [
      createTextColumn(
        "id",
        "ID",
        (snapshot: SnapshotListItem) => snapshot.id,
        {
          width: idWidth + 1,
          color: colors.idColor,
          dimColor: false,
          bold: false,
        },
      ),
      createTextColumn(
        "name",
        "Name",
        (snapshot: SnapshotListItem) => snapshot.name || "",
        {
          width: nameWidth,
        },
      ),
      createTextColumn(
        "devbox",
        "Devbox",
        (snapshot: SnapshotListItem) => snapshot.source_devbox_id || "",
        {
          width: devboxWidth,
          color: colors.idColor,
          dimColor: false,
          bold: false,
          visible: showDevboxIdColumn,
        },
      ),
      createTextColumn(
        "created",
        "Created",
        (snapshot: SnapshotListItem) =>
          snapshot.create_time_ms ? formatTimeAgo(snapshot.create_time_ms) : "",
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
    ],
    [idWidth, nameWidth, devboxWidth, timeWidth, showDevboxIdColumn],
  );

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (snapshots.length > 0 && selectedIndex >= snapshots.length) {
      setSelectedIndex(Math.max(0, snapshots.length - 1));
    }
  }, [snapshots.length, selectedIndex]);

  const selectedSnapshotItem = snapshots[selectedIndex];

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + snapshots.length;

  const executeOperation = async () => {
    const client = getClient();
    const snapshot = selectedSnapshot;

    if (!snapshot) return;

    try {
      setOperationLoading(true);
      switch (executingOperation) {
        case "delete":
          await client.devboxes.deleteDiskSnapshot(snapshot.id);
          setOperationResult(`Snapshot ${snapshot.id} deleted successfully`);
          break;
      }
    } catch (err) {
      setOperationError(err as Error);
    } finally {
      setOperationLoading(false);
    }
  };

  useInput((input, key) => {
    // Handle operation result display
    if (operationResult || operationError) {
      if (input === "q" || key.escape || key.return) {
        setOperationResult(null);
        setOperationError(null);
        setExecutingOperation(null);
        setSelectedSnapshot(null);
      }
      return;
    }

    // Handle create devbox view
    if (showCreateDevbox) {
      return;
    }

    // Handle popup navigation
    if (showPopup) {
      if (key.upArrow && selectedOperation > 0) {
        setSelectedOperation(selectedOperation - 1);
      } else if (key.downArrow && selectedOperation < operations.length - 1) {
        setSelectedOperation(selectedOperation + 1);
      } else if (key.return) {
        setShowPopup(false);
        const operationKey = operations[selectedOperation].key;

        if (operationKey === "create_devbox") {
          setSelectedSnapshot(selectedSnapshotItem);
          setShowCreateDevbox(true);
        } else {
          setSelectedSnapshot(selectedSnapshotItem);
          setExecutingOperation(operationKey);
          // Execute immediately after state update
          setTimeout(() => executeOperation(), 0);
        }
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (input === "c") {
        // Create devbox hotkey
        setShowPopup(false);
        setSelectedSnapshot(selectedSnapshotItem);
        setShowCreateDevbox(true);
      } else if (input === "d") {
        // Delete hotkey
        setShowPopup(false);
        setSelectedSnapshot(selectedSnapshotItem);
        setExecutingOperation("delete");
        setTimeout(() => executeOperation(), 0);
      }
      return;
    }

    const pageSnapshots = snapshots.length;

    // Handle list view navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageSnapshots - 1) {
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
    } else if (input === "a" && selectedSnapshotItem) {
      setShowPopup(true);
      setSelectedOperation(0);
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

  // Operation result display
  if (operationResult || operationError) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label ||
      "Operation";
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Snapshots" },
            {
              label:
                selectedSnapshot?.name || selectedSnapshot?.id || "Snapshot",
            },
            { label: operationLabel, active: true },
          ]}
        />
        <Header title="Operation Result" />
        {operationResult && <SuccessMessage message={operationResult} />}
        {operationError && (
          <ErrorMessage message="Operation failed" error={operationError} />
        )}
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            Press [Enter], [q], or [esc] to continue
          </Text>
        </Box>
      </>
    );
  }

  // Operation loading state
  if (operationLoading && selectedSnapshot) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label ||
      "Operation";
    const messages: Record<string, string> = {
      delete: "Deleting snapshot...",
    };
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Snapshots" },
            { label: selectedSnapshot.name || selectedSnapshot.id },
            { label: operationLabel, active: true },
          ]}
        />
        <Header title="Executing Operation" />
        <SpinnerComponent
          message={messages[executingOperation as string] || "Please wait..."}
        />
      </>
    );
  }

  // Create devbox screen
  if (showCreateDevbox && selectedSnapshot) {
    return (
      <DevboxCreatePage
        onBack={() => {
          setShowCreateDevbox(false);
          setSelectedSnapshot(null);
        }}
        onCreate={(devbox) => {
          setShowCreateDevbox(false);
          setSelectedSnapshot(null);
          navigate("devbox-detail", { devboxId: devbox.id });
        }}
        initialSnapshotId={selectedSnapshot.id}
      />
    );
  }

  // Loading state
  if (loading && snapshots.length === 0) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Snapshots", active: !devboxId },
            ...(devboxId
              ? [{ label: `Devbox: ${devboxId}`, active: true }]
              : []),
          ]}
        />
        <SpinnerComponent message="Loading snapshots..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Snapshots", active: !devboxId },
            ...(devboxId
              ? [{ label: `Devbox: ${devboxId}`, active: true }]
              : []),
          ]}
        />
        <ErrorMessage message="Failed to list snapshots" error={error} />
      </>
    );
  }

  // Empty state
  if (snapshots.length === 0) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Snapshots", active: !devboxId },
            ...(devboxId
              ? [{ label: `Devbox: ${devboxId}`, active: true }]
              : []),
          ]}
        />
        <Box>
          <Text color={colors.warning}>{figures.info}</Text>
          <Text> No snapshots found. Try: </Text>
          <Text color={colors.primary} bold>
            rli snapshot create {"<devbox-id>"}
          </Text>
        </Box>
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Snapshots", active: !devboxId },
          ...(devboxId ? [{ label: `Devbox: ${devboxId}`, active: true }] : []),
        ]}
      />

      {/* Table - hide when popup is shown */}
      {!showPopup && (
        <Table
          data={snapshots}
          keyExtractor={(snapshot: SnapshotListItem) => snapshot.id}
          selectedIndex={selectedIndex}
          title={`snapshots[${totalCount}]`}
          columns={columns}
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
        </Box>
      )}

      {/* Actions Popup */}
      {showPopup && selectedSnapshotItem && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedSnapshotItem}
            operations={operations.map((op) => ({
              key: op.key,
              label: op.label,
              color: op.color,
              icon: op.icon,
              shortcut:
                op.key === "create_devbox"
                  ? "c"
                  : op.key === "delete"
                    ? "d"
                    : "",
            }))}
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
        {(hasMore || hasPrev) && (
          <Text color={colors.textDim} dimColor>
            {" "}
            • {figures.arrowLeft}
            {figures.arrowRight} Page
          </Text>
        )}
        <Text color={colors.textDim} dimColor>
          {" "}
          • [a] Actions
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
export { ListSnapshotsUI };

export async function listSnapshots(options: ListOptions) {
  try {
    const client = getClient();

    // Build query params
    const queryParams: Record<string, unknown> = {
      limit: DEFAULT_PAGE_SIZE,
    };
    if (options.devbox) {
      queryParams.devbox_id = options.devbox;
    }

    // Fetch snapshots
    const page = (await client.devboxes.listDiskSnapshots(
      queryParams,
    )) as DiskSnapshotsCursorIDPage<{ id: string }>;

    // Extract snapshots array
    const snapshots = page.snapshots || [];

    output(snapshots, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list snapshots", error);
  }
}

import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import type { DiskSnapshotsCursorIDPage } from "@runloop/api-client/pagination";
import type { DevboxSnapshotView } from "@runloop/api-client/resources/devboxes/devboxes";
import { getClient } from "../../utils/client.js";
import { Header } from "../../components/Header.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { SuccessMessage } from "../../components/SuccessMessage.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";
import { NavigationTips } from "../../components/NavigationTips.js";
import { Table, createTextColumn } from "../../components/Table.js";
import { ActionsPopup } from "../../components/ActionsPopup.js";
import { Operation } from "../../components/OperationsMenu.js";
import { formatTimeAgo } from "../../components/ResourceListView.js";
import { SearchBar } from "../../components/SearchBar.js";
import { output, outputError } from "../../utils/output.js";
import { colors } from "../../utils/theme.js";
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../../hooks/useExitOnCtrlC.js";
import { useCursorPagination } from "../../hooks/useCursorPagination.js";
import { useListSearch } from "../../hooks/useListSearch.js";
import { DevboxCreatePage } from "../../components/DevboxCreatePage.js";
import { useNavigation } from "../../store/navigationStore.js";
import { ConfirmationPrompt } from "../../components/ConfirmationPrompt.js";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Search state
  const search = useListSearch({
    onSearchSubmit: () => setSelectedIndex(0),
    onSearchClear: () => setSelectedIndex(0),
  });

  // Calculate overhead for viewport height
  const overhead = 13 + search.getSearchOverhead();
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  const PAGE_SIZE = viewportHeight;

  // All width constants
  const fixedWidth = 6; // border + padding
  const idWidth = 25;
  const devboxWidth = 15;
  const timeWidth = 20;
  const showDevboxIdColumn = terminalWidth >= 100 && !devboxId;

  // Name width uses remaining space after fixed columns
  const baseWidth = fixedWidth + idWidth + timeWidth;
  const optionalWidth = showDevboxIdColumn ? devboxWidth : 0;
  const remainingWidth = terminalWidth - baseWidth - optionalWidth;
  const nameWidth = Math.min(80, Math.max(15, remainingWidth));

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
      if (search.submittedSearchQuery) {
        queryParams.search = search.submittedSearchQuery;
      }

      const page = await client.devboxes.listDiskSnapshots(queryParams);

      // Extract data and create defensive copies
      if (page.snapshots && Array.isArray(page.snapshots)) {
        page.snapshots.forEach((s: DevboxSnapshotView) => {
          pageSnapshots.push({
            id: s.id,
            name: s.name ?? undefined,
            status: (s as DevboxSnapshotView & { status?: string }).status,
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
    [devboxId, search.submittedSearchQuery],
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
    refresh,
  } = useCursorPagination({
    fetchPage,
    pageSize: PAGE_SIZE,
    getItemId: (snapshot: SnapshotListItem) => snapshot.id,
    pollInterval: 2000,
    pollingEnabled:
      !showPopup &&
      !executingOperation &&
      !showCreateDevbox &&
      !showDeleteConfirm &&
      !search.searchMode,
    deps: [devboxId, PAGE_SIZE, search.submittedSearchQuery],
  });

  // Operations for snapshots
  const operations: Operation[] = React.useMemo(
    () => [
      {
        key: "view_details",
        label: "View Details",
        color: colors.primary,
        icon: figures.pointer,
      },
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

  const executeOperation = async (
    snapshot: SnapshotListItem,
    operationKey: string,
  ) => {
    const client = getClient();

    if (!snapshot) return;

    try {
      setOperationLoading(true);
      switch (operationKey) {
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
    // Handle search mode input
    if (search.searchMode) {
      if (key.escape) {
        search.cancelSearch();
      }
      return;
    }

    // Handle operation result display
    if (operationResult || operationError) {
      if (input === "q" || key.escape || key.return) {
        const wasDelete = executingOperation === "delete";
        const hadError = operationError !== null;
        setOperationResult(null);
        setOperationError(null);
        setExecutingOperation(null);
        setSelectedSnapshot(null);
        // Refresh the list after delete to show updated data
        if (wasDelete && !hadError) {
          setTimeout(() => refresh(), 0);
        }
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

        if (operationKey === "view_details") {
          navigate("snapshot-detail", {
            snapshotId: selectedSnapshotItem.id,
          });
        } else if (operationKey === "create_devbox") {
          setSelectedSnapshot(selectedSnapshotItem);
          setShowCreateDevbox(true);
        } else if (operationKey === "delete") {
          // Show delete confirmation
          setSelectedSnapshot(selectedSnapshotItem);
          setShowDeleteConfirm(true);
        } else {
          setSelectedSnapshot(selectedSnapshotItem);
          setExecutingOperation(operationKey);
          // Execute immediately with values passed directly
          executeOperation(selectedSnapshotItem, operationKey);
        }
      } else if (input === "v" && selectedSnapshotItem) {
        // View details hotkey
        setShowPopup(false);
        navigate("snapshot-detail", {
          snapshotId: selectedSnapshotItem.id,
        });
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (input === "c") {
        // Create devbox hotkey
        setShowPopup(false);
        setSelectedSnapshot(selectedSnapshotItem);
        setShowCreateDevbox(true);
      } else if (input === "d") {
        // Delete hotkey - show confirmation
        setShowPopup(false);
        setSelectedSnapshot(selectedSnapshotItem);
        setShowDeleteConfirm(true);
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
    } else if (key.return && selectedSnapshotItem) {
      // Enter key navigates to detail view
      navigate("snapshot-detail", {
        snapshotId: selectedSnapshotItem.id,
      });
    } else if (input === "a" && selectedSnapshotItem) {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "/") {
      search.enterSearchMode();
    } else if (key.escape) {
      if (search.handleEscape()) {
        return;
      }
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
        <NavigationTips tips={[{ key: "Enter/q/esc", label: "Continue" }]} />
      </>
    );
  }

  // Delete confirmation
  if (showDeleteConfirm && selectedSnapshot) {
    return (
      <ConfirmationPrompt
        title="Delete Snapshot"
        message={`Are you sure you want to delete "${selectedSnapshot.name || selectedSnapshot.id}"?`}
        details="This action cannot be undone."
        breadcrumbItems={[
          { label: "Snapshots" },
          { label: selectedSnapshot.name || selectedSnapshot.id },
          { label: "Delete", active: true },
        ]}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          setExecutingOperation("delete");
          executeOperation(selectedSnapshot, "delete");
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSelectedSnapshot(null);
        }}
      />
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

  // Main list view
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Snapshots", active: !devboxId },
          ...(devboxId ? [{ label: `Devbox: ${devboxId}`, active: true }] : []),
        ]}
      />

      {/* Search bar */}
      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search snapshots..."
      />

      {/* Table - hide when popup is shown */}
      {!showPopup && (
        <Table
          data={snapshots}
          keyExtractor={(snapshot: SnapshotListItem) => snapshot.id}
          selectedIndex={selectedIndex}
          title={`snapshots[${totalCount}]`}
          columns={columns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No snapshots found. Try: rli snapshot create{" "}
              {"<devbox-id>"}
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
          {search.submittedSearchQuery && (
            <>
              <Text color={colors.textDim} dimColor>
                {" "}
                •{" "}
              </Text>
              <Text color={colors.warning}>
                Filtered: &quot;{search.submittedSearchQuery}&quot;
              </Text>
            </>
          )}
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
                op.key === "view_details"
                  ? "v"
                  : op.key === "create_devbox"
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
          { key: "/", label: "Search" },
          { key: "Esc", label: "Back" },
        ]}
      />
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
    )) as DiskSnapshotsCursorIDPage<DevboxSnapshotView>;

    // Extract snapshots array and strip to plain objects to avoid
    // camelCase aliases added by the API client library
    const snapshots = (page.snapshots || []).map((s) => ({
      id: s.id,
      name: s.name ?? undefined,
      create_time_ms: s.create_time_ms,
      metadata: s.metadata,
      source_devbox_id: s.source_devbox_id,
      source_blueprint_id: s.source_blueprint_id ?? undefined,
      commit_message: s.commit_message ?? undefined,
    }));

    output(snapshots, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list snapshots", error);
  }
}

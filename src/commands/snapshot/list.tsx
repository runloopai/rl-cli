import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import type { DiskSnapshotsCursorIDPage } from "@runloop/api-client/pagination";
import { getClient } from "../../utils/client.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";
import { Table, createTextColumn } from "../../components/Table.js";
import { formatTimeAgo } from "../../components/ResourceListView.js";
import { createExecutor } from "../../utils/CommandExecutor.js";
import { colors } from "../../utils/theme.js";
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../../hooks/useExitOnCtrlC.js";
import { useCursorPagination } from "../../hooks/useCursorPagination.js";

interface ListOptions {
  devbox?: string;
  output?: string;
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
  const [selectedIndex, setSelectedIndex] = React.useState(0);

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
  const showDevboxId = terminalWidth >= 100 && !devboxId;

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const client = getClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageSnapshots: any[] = [];

      // Build query params
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queryParams: any = {
        limit: params.limit,
      };
      if (params.startingAt) {
        queryParams.starting_after = params.startingAt;
      }
      if (devboxId) {
        queryParams.devbox_id = devboxId;
      }

      // Fetch ONE page only
      let page = (await client.devboxes.listDiskSnapshots(
        queryParams,
      )) as DiskSnapshotsCursorIDPage<{ id: string }>;

      // Extract data and create defensive copies
      if (page.snapshots && Array.isArray(page.snapshots)) {
        page.snapshots.forEach((s: any) => {
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

      // Help GC
      page = null as any;

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
    getItemId: (snapshot: any) => snapshot.id,
    pollInterval: 2000,
    deps: [devboxId, PAGE_SIZE],
  });

  // Build columns
  const columns = React.useMemo(
    () => [
      createTextColumn("id", "ID", (snapshot: any) => snapshot.id, {
        width: idWidth,
        color: colors.idColor,
        dimColor: false,
        bold: false,
      }),
      createTextColumn(
        "name",
        "Name",
        (snapshot: any) => snapshot.name || "(unnamed)",
        {
          width: nameWidth,
        },
      ),
      createTextColumn(
        "devbox",
        "Devbox",
        (snapshot: any) => snapshot.source_devbox_id || "",
        {
          width: devboxWidth,
          color: colors.idColor,
          dimColor: false,
          bold: false,
          visible: showDevboxId,
        },
      ),
      createTextColumn(
        "created",
        "Created",
        (snapshot: any) =>
          snapshot.create_time_ms ? formatTimeAgo(snapshot.create_time_ms) : "",
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
    ],
    [idWidth, nameWidth, devboxWidth, timeWidth, showDevboxId],
  );

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (snapshots.length > 0 && selectedIndex >= snapshots.length) {
      setSelectedIndex(Math.max(0, snapshots.length - 1));
    }
  }, [snapshots.length, selectedIndex]);

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + snapshots.length;

  useInput((input, key) => {
    const pageSnapshots = snapshots.length;

    // Handle list view navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageSnapshots - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if ((input === "n" || key.rightArrow) && !loading && !navigating && hasMore) {
      nextPage();
      setSelectedIndex(0);
    } else if ((input === "p" || key.leftArrow) && !loading && !navigating && hasPrev) {
      prevPage();
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

  // Loading state
  if (loading && snapshots.length === 0) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Snapshots", active: !devboxId },
            ...(devboxId ? [{ label: `Devbox: ${devboxId}`, active: true }] : []),
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
            ...(devboxId ? [{ label: `Devbox: ${devboxId}`, active: true }] : []),
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
            ...(devboxId ? [{ label: `Devbox: ${devboxId}`, active: true }] : []),
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

      {/* Table */}
      <Table
        data={snapshots}
        keyExtractor={(snapshot: any) => snapshot.id}
        selectedIndex={selectedIndex}
        title={`snapshots[${totalCount}]`}
        columns={columns}
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
          • [Esc] Back
        </Text>
      </Box>
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
      return executor.fetchFromIterator(
        client.devboxes.listDiskSnapshots(params),
        {
          limit: DEFAULT_PAGE_SIZE,
        },
      );
    },
    () => <ListSnapshotsUI devboxId={options.devbox} />,
    DEFAULT_PAGE_SIZE,
  );
}

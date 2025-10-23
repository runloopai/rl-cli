import React from "react";
import { render, Box, Text, useInput, useStdout, useApp } from "ink";
import figures from "figures";
import type { DiskSnapshotsCursorIDPage } from "@runloop/api-client/pagination";
import { getClient } from "../../utils/client.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { StatusBadge, getStatusDisplay } from "../../components/StatusBadge.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";
import {
  Table,
  createTextColumn,
  createComponentColumn,
} from "../../components/Table.js";
import {
  ResourceListView,
  formatTimeAgo,
} from "../../components/ResourceListView.js";
import { createExecutor } from "../../utils/CommandExecutor.js";
import { colors } from "../../utils/theme.js";

interface ListOptions {
  devbox?: string;
  output?: string;
}

const PAGE_SIZE = 10;
const MAX_FETCH = 100;

const ListSnapshotsUI: React.FC<{
  devboxId?: string;
  onBack?: () => void;
  onExit?: () => void;
}> = ({ devboxId, onBack, onExit }) => {
  const { stdout } = useStdout();

  // Calculate responsive column widths ONCE on mount
  const terminalWidth = React.useMemo(() => stdout?.columns || 120, []);
  const showDevboxId = React.useMemo(
    () => terminalWidth >= 100 && !devboxId,
    [terminalWidth, devboxId],
  ); // Hide devbox column if filtering by devbox
  const showFullId = React.useMemo(() => terminalWidth >= 80, [terminalWidth]);

  const statusIconWidth = 2;
  const statusTextWidth = 10;
  const idWidth = 25;
  const nameWidth = terminalWidth >= 120 ? 30 : 25;
  const devboxWidth = 15;
  const timeWidth = 20;

  return (
    <ResourceListView
      config={{
        resourceName: "Snapshot",
        resourceNamePlural: "Snapshots",
        fetchResources: async () => {
          const client = getClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pageSnapshots: any[] = [];

          // Fetch only ONE page at a time (MAX_FETCH = 100 items)
          // Can be filtered by devbox_id if provided
          const params = devboxId
            ? { devbox_id: devboxId, limit: MAX_FETCH }
            : { limit: MAX_FETCH };
          const pageResponse = client.devboxes.listDiskSnapshots(params);

          // CRITICAL: We must NOT use async iteration as it triggers auto-pagination
          // Access the page object directly which contains the data
          const page = (await pageResponse) as DiskSnapshotsCursorIDPage<{
            id: string;
          }>;

          // Access the snapshots array directly from the typed page object
          if (page.snapshots && Array.isArray(page.snapshots)) {
            // CRITICAL: Create defensive copies to break reference chains
            // The SDK's page object might hold references to HTTP responses
            pageSnapshots.push(
              ...page.snapshots.map((s: any) => ({
                id: s.id,
                name: s.name,
                status: s.status,
                create_time_ms: s.create_time_ms,
                source_devbox_id: s.source_devbox_id,
                // Copy only the fields we need, don't hold entire object
              })),
            );
          } else {
            console.error(
              "Unable to access snapshots from page. Available keys:",
              Object.keys(page || {}),
            );
          }

          return pageSnapshots;
        },
        columns: [
          createTextColumn("id", "ID", (snapshot: any) => snapshot.id, {
            width: idWidth,
            color: colors.textDim,
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
              color: colors.primary,
              dimColor: false,
              bold: false,
              visible: showDevboxId,
            },
          ),
          createTextColumn(
            "created",
            "Created",
            (snapshot: any) =>
              snapshot.create_time_ms
                ? formatTimeAgo(snapshot.create_time_ms)
                : "",
            {
              width: timeWidth,
              color: colors.textDim,
              dimColor: false,
              bold: false,
            },
          ),
        ],
        keyExtractor: (snapshot: any) => snapshot.id,
        emptyState: {
          message: "No snapshots found. Try:",
          command: "rli snapshot create <devbox-id>",
        },
        pageSize: PAGE_SIZE,
        maxFetch: MAX_FETCH,
        onBack: onBack,
        onExit: onExit,
        breadcrumbItems: [
          { label: "Snapshots", active: !devboxId },
          ...(devboxId ? [{ label: `Devbox: ${devboxId}`, active: true }] : []),
        ],
      }}
    />
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
          limit: PAGE_SIZE,
        },
      );
    },
    () => <ListSnapshotsUI devboxId={options.devbox} />,
    PAGE_SIZE,
  );
}

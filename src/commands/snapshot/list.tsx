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

  // Sample terminal width ONCE for fixed layout - no reactive dependencies to avoid re-renders
  // CRITICAL: Initialize with fallback value to prevent any possibility of null/undefined
  const terminalWidth = React.useRef<number>(120);
  if (terminalWidth.current === 120) {
    // Only sample on first render if stdout has valid width
    const sampledWidth = (stdout?.columns && stdout.columns > 0) ? stdout.columns : 120;
    terminalWidth.current = Math.max(80, Math.min(200, sampledWidth));
  }
  const fixedWidth = terminalWidth.current;

  // All width constants - guaranteed to be valid positive integers
  const statusIconWidth = 2;
  const statusTextWidth = 10;
  const idWidth = 25;
  const nameWidth = Math.max(15, fixedWidth >= 120 ? 30 : 25);
  const devboxWidth = 15;
  const timeWidth = 20;
  const showDevboxId = fixedWidth >= 100 && !devboxId; // Hide devbox column if filtering by devbox
  const showFullId = fixedWidth >= 80;

  return (
    <ResourceListView
      config={{
        resourceName: "Snapshot",
        resourceNamePlural: "Snapshots",
        fetchResources: async () => {
          const client = getClient();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pageSnapshots: any[] = [];

          // CRITICAL: Fetch ONLY ONE page with limit, never auto-paginate
          // DO NOT iterate or use for-await - that fetches ALL pages
          const params = devboxId
            ? { devbox_id: devboxId, limit: MAX_FETCH }
            : { limit: MAX_FETCH };
          const pagePromise = client.devboxes.listDiskSnapshots(params);

          // Await to get the Page object (NOT async iteration)
          let page = (await pagePromise) as DiskSnapshotsCursorIDPage<{
            id: string;
          }>;

          // Extract data immediately and create defensive copies
          if (page.snapshots && Array.isArray(page.snapshots)) {
            // Copy ONLY the fields we need - don't hold entire SDK objects
            page.snapshots.forEach((s: any) => {
              pageSnapshots.push({
                id: s.id,
                name: s.name,
                status: s.status,
                create_time_ms: s.create_time_ms,
                source_devbox_id: s.source_devbox_id,
              });
            });
          } else {
            console.error(
              "Unable to access snapshots from page. Available keys:",
              Object.keys(page || {}),
            );
          }

          // CRITICAL: Explicitly null out page reference to help GC
          // The Page object holds references to client, response, and options
          page = null as any;

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

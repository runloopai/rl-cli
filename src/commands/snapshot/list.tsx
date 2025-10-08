import React from "react";
import { render, Box, Text, useInput, useStdout, useApp } from "ink";
import figures from "figures";
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

  // Calculate responsive column widths
  const terminalWidth = stdout?.columns || 120;
  const showDevboxId = terminalWidth >= 100 && !devboxId; // Hide devbox column if filtering by devbox
  const showFullId = terminalWidth >= 80;

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
          const allSnapshots: any[] = [];
          let count = 0;
          const params = devboxId ? { devbox_id: devboxId } : {};
          for await (const snapshot of client.devboxes.listDiskSnapshots(
            params,
          )) {
            allSnapshots.push(snapshot);
            count++;
            if (count >= MAX_FETCH) break;
          }
          return allSnapshots;
        },
        columns: [
          createTextColumn("id", "ID", (snapshot: any) => snapshot.id, {
            width: idWidth,
            color: colors.textDim,
            dimColor: true,
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
              dimColor: true,
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
              dimColor: true,
              bold: false,
            },
          ),
        ],
        keyExtractor: (snapshot: any) => snapshot.id,
        emptyState: {
          message: "No snapshots found. Try:",
          command: "rln snapshot create <devbox-id>",
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

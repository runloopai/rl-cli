/**
 * SnapshotDetailScreen - Detail page for snapshots
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import { useSnapshotStore, type Snapshot } from "../store/snapshotStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import { getSnapshot, deleteSnapshot } from "../services/snapshotService.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { ConfirmationPrompt } from "../components/ConfirmationPrompt.js";
import { colors } from "../utils/theme.js";

interface SnapshotDetailScreenProps {
  snapshotId?: string;
}

export function SnapshotDetailScreen({
  snapshotId,
}: SnapshotDetailScreenProps) {
  const { goBack, navigate } = useNavigation();
  const snapshots = useSnapshotStore((state) => state.snapshots);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [fetchedSnapshot, setFetchedSnapshot] = React.useState<Snapshot | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Find snapshot in store first
  const snapshotFromStore = snapshots.find((s) => s.id === snapshotId);

  // Polling function - must be defined before any early returns (Rules of Hooks)
  const pollSnapshot = React.useCallback(async () => {
    if (!snapshotId) return null as unknown as Snapshot;
    return getSnapshot(snapshotId);
  }, [snapshotId]);

  // Fetch snapshot from API if not in store or missing full details
  React.useEffect(() => {
    if (snapshotId && !loading && !fetchedSnapshot) {
      // Always fetch full details since store may only have basic info
      setLoading(true);
      setError(null);

      getSnapshot(snapshotId)
        .then((snapshot) => {
          setFetchedSnapshot(snapshot);
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [snapshotId, loading, fetchedSnapshot]);

  // Use fetched snapshot for full details, fall back to store for basic display
  const snapshot = fetchedSnapshot || snapshotFromStore;

  // Show loading state while fetching or before fetch starts
  if (!snapshot && snapshotId && !error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Snapshots" },
            { label: "Loading...", active: true },
          ]}
        />
        <SpinnerComponent message="Loading snapshot details..." />
      </>
    );
  }

  // Show error state if fetch failed
  if (error && !snapshot) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Snapshots" }, { label: "Error", active: true }]}
        />
        <ErrorMessage message="Failed to load snapshot details" error={error} />
      </>
    );
  }

  // Show error if no snapshot found
  if (!snapshot) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Snapshots" }, { label: "Not Found", active: true }]}
        />
        <ErrorMessage
          message={`Snapshot ${snapshotId || "unknown"} not found`}
          error={new Error("Snapshot not found")}
        />
      </>
    );
  }

  // Build detail sections
  const detailSections: DetailSection[] = [];

  // Basic details section
  const basicFields = [];
  if (snapshot.create_time_ms) {
    basicFields.push({
      label: "Created",
      value: formatTimestamp(snapshot.create_time_ms),
    });
  }
  if (snapshot.devbox_id) {
    basicFields.push({
      label: "Source Devbox",
      value: <Text color={colors.idColor}>{snapshot.devbox_id}</Text>,
    });
  }
  if (snapshot.disk_size_bytes) {
    const sizeGB = (snapshot.disk_size_bytes / (1024 * 1024 * 1024)).toFixed(2);
    basicFields.push({
      label: "Disk Size",
      value: `${sizeGB} GB`,
    });
  }

  if (basicFields.length > 0) {
    detailSections.push({
      title: "Details",
      icon: figures.squareSmallFilled,
      color: colors.warning,
      fields: basicFields,
    });
  }

  // Metadata section
  if (snapshot.metadata && Object.keys(snapshot.metadata).length > 0) {
    const metadataFields = Object.entries(snapshot.metadata).map(
      ([key, value]) => ({
        label: key,
        value: value,
      }),
    );

    detailSections.push({
      title: "Metadata",
      icon: figures.identical,
      color: colors.secondary,
      fields: metadataFields,
    });
  }

  // Operations available for snapshots
  const operations: ResourceOperation[] = [
    {
      key: "create-devbox",
      label: "Create Devbox from Snapshot",
      color: colors.success,
      icon: figures.play,
      shortcut: "c",
    },
    {
      key: "delete",
      label: "Delete Snapshot",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  // Handle operation selection
  const handleOperation = async (operation: string, resource: Snapshot) => {
    switch (operation) {
      case "create-devbox":
        navigate("devbox-create", { snapshotId: resource.id });
        break;
      case "delete":
        // Show confirmation dialog
        setShowDeleteConfirm(true);
        break;
    }
  };

  // Execute delete after confirmation
  const executeDelete = async () => {
    if (!snapshot) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await deleteSnapshot(snapshot.id);
      goBack();
    } catch (err) {
      setError(err as Error);
      setDeleting(false);
    }
  };

  // Build detailed info lines for full details view
  const buildDetailLines = (snap: Snapshot): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        Snapshot Details
      </Text>,
    );
    lines.push(
      <Text key="core-id" color={colors.idColor}>
        {" "}
        ID: {snap.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {snap.name || "(none)"}
      </Text>,
    );
    lines.push(
      <Text key="core-status" dimColor>
        {" "}
        Status: {snap.status}
      </Text>,
    );
    if (snap.devbox_id) {
      lines.push(
        <Text key="core-devbox" color={colors.idColor}>
          {" "}
          Source Devbox: {snap.devbox_id}
        </Text>,
      );
    }
    if (snap.create_time_ms) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Created: {new Date(snap.create_time_ms).toLocaleString()}
        </Text>,
      );
    }
    if (snap.disk_size_bytes) {
      const sizeGB = (snap.disk_size_bytes / (1024 * 1024 * 1024)).toFixed(2);
      lines.push(
        <Text key="core-size" dimColor>
          {" "}
          Disk Size: {sizeGB} GB
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Metadata
    if (snap.metadata && Object.keys(snap.metadata).length > 0) {
      lines.push(
        <Text key="meta-title" color={colors.warning} bold>
          Metadata
        </Text>,
      );
      Object.entries(snap.metadata).forEach(([key, value], idx) => {
        lines.push(
          <Text key={`meta-${idx}`} dimColor>
            {" "}
            {key}: {value}
          </Text>,
        );
      });
      lines.push(<Text key="meta-space"> </Text>);
    }

    // Raw JSON
    lines.push(
      <Text key="json-title" color={colors.warning} bold>
        Raw JSON
      </Text>,
    );
    const jsonLines = JSON.stringify(snap, null, 2).split("\n");
    jsonLines.forEach((line, idx) => {
      lines.push(
        <Text key={`json-${idx}`} dimColor>
          {" "}
          {line}
        </Text>,
      );
    });

    return lines;
  };

  // Show delete confirmation
  if (showDeleteConfirm && snapshot) {
    return (
      <ConfirmationPrompt
        title="Delete Snapshot"
        message={`Are you sure you want to delete "${snapshot.name || snapshot.id}"?`}
        details="This action cannot be undone."
        breadcrumbItems={[
          { label: "Snapshots" },
          { label: snapshot.name || snapshot.id },
          { label: "Delete", active: true },
        ]}
        onConfirm={executeDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    );
  }

  // Show deleting state
  if (deleting) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Snapshots" },
            { label: snapshot.name || snapshot.id },
            { label: "Deleting...", active: true },
          ]}
        />
        <SpinnerComponent message="Deleting snapshot..." />
      </>
    );
  }

  return (
    <ResourceDetailPage
      resource={snapshot}
      resourceType="Snapshots"
      getDisplayName={(snap) => snap.name || snap.id}
      getId={(snap) => snap.id}
      getStatus={(snap) => snap.status || "unknown"}
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
      pollResource={snapshot.status === "pending" ? pollSnapshot : undefined}
    />
  );
}

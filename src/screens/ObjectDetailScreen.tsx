/**
 * ObjectDetailScreen - Detail page for storage objects
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import { useObjectStore, type StorageObject } from "../store/objectStore.js";
import {
  ResourceDetailPage,
  formatTimestamp,
  type DetailSection,
  type ResourceOperation,
} from "../components/ResourceDetailPage.js";
import {
  getObject,
  deleteObject,
  formatFileSize,
} from "../services/objectService.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { colors } from "../utils/theme.js";

interface ObjectDetailScreenProps {
  objectId?: string;
}

export function ObjectDetailScreen({ objectId }: ObjectDetailScreenProps) {
  const { goBack } = useNavigation();
  const objects = useObjectStore((state) => state.objects);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [fetchedObject, setFetchedObject] =
    React.useState<StorageObject | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Find object in store first
  const objectFromStore = objects.find((o) => o.id === objectId);

  // Polling function - must be defined before any early returns (Rules of Hooks)
  const pollObject = React.useCallback(async () => {
    if (!objectId) return null as unknown as StorageObject;
    return getObject(objectId);
  }, [objectId]);

  // Fetch object from API if not in store or missing full details
  React.useEffect(() => {
    if (objectId && !loading && !fetchedObject) {
      // Always fetch full details since store may only have basic info
      setLoading(true);
      setError(null);

      getObject(objectId)
        .then((obj) => {
          setFetchedObject(obj);
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [objectId, loading, fetchedObject]);

  // Use fetched object for full details, fall back to store for basic display
  const storageObject = fetchedObject || objectFromStore;

  // Show loading state while fetching
  if (loading && !storageObject) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Objects" }, { label: "Loading...", active: true }]}
        />
        <SpinnerComponent message="Loading object details..." />
      </>
    );
  }

  // Show error state if fetch failed
  if (error && !storageObject) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Objects" }, { label: "Error", active: true }]}
        />
        <ErrorMessage message="Failed to load object details" error={error} />
      </>
    );
  }

  // Show error if no object found
  if (!storageObject) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Objects" }, { label: "Not Found", active: true }]}
        />
        <ErrorMessage
          message={`Object ${objectId || "unknown"} not found`}
          error={new Error("Object not found")}
        />
      </>
    );
  }

  // Build detail sections
  const detailSections: DetailSection[] = [];

  // Basic details section
  const basicFields = [];
  if (storageObject.content_type) {
    basicFields.push({
      label: "Content Type",
      value: storageObject.content_type,
    });
  }
  if (storageObject.size_bytes !== undefined) {
    basicFields.push({
      label: "Size",
      value: formatFileSize(storageObject.size_bytes),
    });
  }
  if (storageObject.state) {
    basicFields.push({
      label: "State",
      value: storageObject.state,
    });
  }
  if (storageObject.is_public !== undefined) {
    basicFields.push({
      label: "Public",
      value: storageObject.is_public ? "Yes" : "No",
    });
  }
  if (storageObject.create_time_ms) {
    basicFields.push({
      label: "Created",
      value: formatTimestamp(storageObject.create_time_ms),
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

  // Download URL section
  if (storageObject.download_url) {
    detailSections.push({
      title: "Download",
      icon: figures.arrowDown,
      color: colors.success,
      fields: [
        {
          label: "URL",
          value: (
            <Text color={colors.info}>
              {storageObject.download_url.substring(0, 60)}...
            </Text>
          ),
        },
      ],
    });
  }

  // Metadata section
  if (
    storageObject.metadata &&
    Object.keys(storageObject.metadata).length > 0
  ) {
    const metadataFields = Object.entries(storageObject.metadata).map(
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

  // Operations available for objects
  const operations: ResourceOperation[] = [
    {
      key: "download",
      label: "Download Object",
      color: colors.success,
      icon: figures.arrowDown,
      shortcut: "w",
    },
    {
      key: "delete",
      label: "Delete Object",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  // Handle operation selection
  const handleOperation = async (
    operation: string,
    resource: StorageObject,
  ) => {
    switch (operation) {
      case "download":
        if (resource.download_url) {
          const { exec } = await import("child_process");
          const platform = process.platform;
          let openCommand: string;
          if (platform === "darwin") {
            openCommand = `open "${resource.download_url}"`;
          } else if (platform === "win32") {
            openCommand = `start "${resource.download_url}"`;
          } else {
            openCommand = `xdg-open "${resource.download_url}"`;
          }
          exec(openCommand);
        }
        break;
      case "delete":
        setDeleting(true);
        try {
          await deleteObject(resource.id);
          goBack();
        } catch (err) {
          setError(err as Error);
          setDeleting(false);
        }
        break;
    }
  };

  // Build detailed info lines for full details view
  const buildDetailLines = (obj: StorageObject): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        Object Details
      </Text>,
    );
    lines.push(
      <Text key="core-id" color={colors.idColor}>
        {" "}
        ID: {obj.id}
      </Text>,
    );
    lines.push(
      <Text key="core-name" dimColor>
        {" "}
        Name: {obj.name || "(none)"}
      </Text>,
    );
    lines.push(
      <Text key="core-type" dimColor>
        {" "}
        Content Type: {obj.content_type || "(unknown)"}
      </Text>,
    );
    lines.push(
      <Text key="core-size" dimColor>
        {" "}
        Size: {formatFileSize(obj.size_bytes)}
      </Text>,
    );
    lines.push(
      <Text key="core-state" dimColor>
        {" "}
        State: {obj.state || "(unknown)"}
      </Text>,
    );
    lines.push(
      <Text key="core-public" dimColor>
        {" "}
        Public: {obj.is_public ? "Yes" : "No"}
      </Text>,
    );
    if (obj.create_time_ms) {
      lines.push(
        <Text key="core-created" dimColor>
          {" "}
          Created: {new Date(obj.create_time_ms).toLocaleString()}
        </Text>,
      );
    }
    lines.push(<Text key="core-space"> </Text>);

    // Download URL
    if (obj.download_url) {
      lines.push(
        <Text key="url-title" color={colors.warning} bold>
          Download URL
        </Text>,
      );
      lines.push(
        <Text key="url-value" color={colors.info}>
          {" "}
          {obj.download_url}
        </Text>,
      );
      lines.push(<Text key="url-space"> </Text>);
    }

    // Metadata
    if (obj.metadata && Object.keys(obj.metadata).length > 0) {
      lines.push(
        <Text key="meta-title" color={colors.warning} bold>
          Metadata
        </Text>,
      );
      Object.entries(obj.metadata).forEach(([key, value], idx) => {
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
    const jsonLines = JSON.stringify(obj, null, 2).split("\n");
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

  // Show deleting state
  if (deleting) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Objects" },
            { label: storageObject.name || storageObject.id },
            { label: "Deleting...", active: true },
          ]}
        />
        <SpinnerComponent message="Deleting object..." />
      </>
    );
  }

  return (
    <ResourceDetailPage
      resource={storageObject}
      resourceType="Objects"
      getDisplayName={(obj) => obj.name || obj.id}
      getId={(obj) => obj.id}
      getStatus={(obj) => obj.state || "unknown"}
      detailSections={detailSections}
      operations={operations}
      onOperation={handleOperation}
      onBack={goBack}
      buildDetailLines={buildDetailLines}
      pollResource={pollObject}
    />
  );
}

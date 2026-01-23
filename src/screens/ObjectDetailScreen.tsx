/**
 * ObjectDetailScreen - Detail page for storage objects
 * Uses the generic ResourceDetailPage component
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { writeFile } from "fs/promises";
import { useNavigation } from "../store/navigationStore.js";
import {
  useObjectStore,
  type StorageObjectView,
} from "../store/objectStore.js";
import { getClient } from "../utils/client.js";
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
import { SuccessMessage } from "../components/SuccessMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { Header } from "../components/Header.js";
import { ConfirmationPrompt } from "../components/ConfirmationPrompt.js";
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
    React.useState<StorageObjectView | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [showDownloadPrompt, setShowDownloadPrompt] = React.useState(false);
  const [downloadPath, setDownloadPath] = React.useState("");
  const [downloading, setDownloading] = React.useState(false);
  const [downloadResult, setDownloadResult] = React.useState<string | null>(
    null,
  );
  const [downloadError, setDownloadError] = React.useState<Error | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // Find object in store first
  const objectFromStore = objects.find((o) => o.id === objectId);

  // Polling function - must be defined before any early returns (Rules of Hooks)
  const pollObject = React.useCallback(async () => {
    if (!objectId) return null as unknown as StorageObjectView;
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

  // Handle download submission
  const handleDownloadSubmit = React.useCallback(async () => {
    if (!downloadPath.trim() || !storageObject) return;

    setShowDownloadPrompt(false);
    setDownloading(true);

    try {
      const client = getClient();
      // Get download URL
      const downloadUrlResponse = await client.objects.download(
        storageObject.id,
        {
          duration_seconds: 3600,
        },
      );
      // Download the file
      const response = await fetch(downloadUrlResponse.download_url);
      if (!response.ok) {
        throw new Error(`Download failed: HTTP ${response.status}`);
      }
      // Save the file
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await writeFile(downloadPath.trim(), buffer);
      setDownloadResult(`Downloaded to ${downloadPath.trim()}`);
    } catch (err) {
      setDownloadError(err as Error);
    } finally {
      setDownloading(false);
    }
  }, [downloadPath, storageObject]);

  // Handle input for download prompt and result screens - must be before early returns (Rules of Hooks)
  useInput(
    (input, key) => {
      if (showDownloadPrompt) {
        if (key.escape) {
          setShowDownloadPrompt(false);
          setDownloadPath("");
        } else if (key.return) {
          handleDownloadSubmit();
        }
        return;
      }

      if (downloadResult || downloadError) {
        if (input === "q" || key.escape || key.return) {
          setDownloadResult(null);
          setDownloadError(null);
          setDownloadPath("");
        }
        return;
      }
    },
    { isActive: showDownloadPrompt || !!downloadResult || !!downloadError },
  );

  // Show loading state while fetching or before fetch starts
  if (!storageObject && objectId && !error) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Storage Objects" },
            { label: "Loading...", active: true },
          ]}
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
          items={[
            { label: "Storage Objects" },
            { label: "Error", active: true },
          ]}
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
          items={[
            { label: "Storage Objects" },
            { label: "Not Found", active: true },
          ]}
        />
        <ErrorMessage
          message={`Storage object ${objectId || "unknown"} not found`}
          error={new Error("Storage object not found")}
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

  // TTL / Expires - show remaining time before auto-deletion
  if (storageObject.delete_after_time_ms) {
    const now = Date.now();
    const remainingMs = storageObject.delete_after_time_ms - now;

    let ttlValue: string;
    let ttlColor = colors.text;

    if (remainingMs <= 0) {
      ttlValue = "Expired";
      ttlColor = colors.error;
    } else {
      const remainingMinutes = Math.floor(remainingMs / 60000);
      if (remainingMinutes < 60) {
        ttlValue = `${remainingMinutes}m remaining`;
        ttlColor = remainingMinutes < 10 ? colors.warning : colors.text;
      } else {
        const hours = Math.floor(remainingMinutes / 60);
        const mins = remainingMinutes % 60;
        ttlValue = `${hours}h ${mins}m remaining`;
      }
    }

    basicFields.push({
      label: "Expires",
      value: <Text color={ttlColor}>{ttlValue}</Text>,
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
      label: "Download",
      color: colors.success,
      icon: figures.arrowDown,
      shortcut: "w",
    },
    {
      key: "delete",
      label: "Delete",
      color: colors.error,
      icon: figures.cross,
      shortcut: "d",
    },
  ];

  // Handle operation selection
  const handleOperation = async (
    operation: string,
    resource: StorageObjectView,
  ) => {
    switch (operation) {
      case "download":
        // Show download prompt
        const defaultName = resource.name || resource.id;
        setDownloadPath(`./${defaultName}`);
        setShowDownloadPrompt(true);
        break;
      case "delete":
        // Show confirmation dialog
        setShowDeleteConfirm(true);
        break;
    }
  };

  // Execute delete after confirmation
  const executeDelete = async () => {
    if (!storageObject) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await deleteObject(storageObject.id);
      goBack();
    } catch (err) {
      setError(err as Error);
      setDeleting(false);
    }
  };

  // Build detailed info lines for full details view
  const buildDetailLines = (obj: StorageObjectView): React.ReactElement[] => {
    const lines: React.ReactElement[] = [];

    // Core Information
    lines.push(
      <Text key="core-title" color={colors.warning} bold>
        Storage Object Details
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
    if (obj.delete_after_time_ms) {
      const now = Date.now();
      const remainingMs = obj.delete_after_time_ms - now;
      let expiresText: string;

      if (remainingMs <= 0) {
        expiresText = "Expired";
      } else {
        const remainingMinutes = Math.floor(remainingMs / 60000);
        if (remainingMinutes < 60) {
          expiresText = `${remainingMinutes}m remaining`;
        } else {
          const hours = Math.floor(remainingMinutes / 60);
          const mins = remainingMinutes % 60;
          expiresText = `${hours}h ${mins}m remaining`;
        }
      }

      lines.push(
        <Text
          key="core-expires"
          color={remainingMs <= 0 ? colors.error : colors.warning}
        >
          {" "}
          Expires: {expiresText}
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

  // Show download result
  if (downloadResult || downloadError) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Storage Objects" },
            { label: storageObject.name || storageObject.id },
            { label: "Download", active: true },
          ]}
        />
        <Header title="Download Result" />
        {downloadResult && <SuccessMessage message={downloadResult} />}
        {downloadError && (
          <ErrorMessage message="Download failed" error={downloadError} />
        )}
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            Press [Enter], [q], or [esc] to continue
          </Text>
        </Box>
      </>
    );
  }

  // Show downloading state
  if (downloading) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Storage Objects" },
            { label: storageObject.name || storageObject.id },
            { label: "Downloading...", active: true },
          ]}
        />
        <SpinnerComponent message={`Downloading to ${downloadPath}...`} />
      </>
    );
  }

  // Show download prompt
  if (showDownloadPrompt) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Storage Objects" },
            { label: storageObject.name || storageObject.id },
            { label: "Download", active: true },
          ]}
        />
        <Header title="Download Storage Object" />
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.text}>
            {figures.arrowRight} Downloading:{" "}
            <Text color={colors.primary}>
              {storageObject.name || storageObject.id}
            </Text>
          </Text>
          {storageObject.size_bytes && (
            <Text color={colors.textDim} dimColor>
              {figures.info} Size: {formatFileSize(storageObject.size_bytes)}
            </Text>
          )}
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.text}>Save to path:</Text>
          <Box marginTop={0}>
            <Text color={colors.primary}>{figures.pointer} </Text>
            <TextInput
              value={downloadPath}
              onChange={setDownloadPath}
              placeholder="./filename"
            />
          </Box>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            [Enter] Download • [Esc] Cancel
          </Text>
        </Box>
      </>
    );
  }

  // Show delete confirmation
  if (showDeleteConfirm && storageObject) {
    return (
      <ConfirmationPrompt
        title="Delete Storage Object"
        message={`Are you sure you want to delete "${storageObject.name || storageObject.id}"?`}
        details="This action cannot be undone."
        breadcrumbItems={[
          { label: "Storage Objects" },
          { label: storageObject.name || storageObject.id },
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
            { label: "Storage Objects" },
            { label: storageObject.name || storageObject.id },
            { label: "Deleting...", active: true },
          ]}
        />
        <SpinnerComponent message="Deleting storage object..." />
      </>
    );
  }

  return (
    <ResourceDetailPage
      resource={storageObject}
      resourceType="Storage Objects"
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

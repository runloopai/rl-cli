import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { writeFile } from "fs/promises";
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
import { useNavigation } from "../../store/navigationStore.js";
import { formatFileSize } from "../../services/objectService.js";
import { ConfirmationPrompt } from "../../components/ConfirmationPrompt.js";

interface ListOptions {
  name?: string;
  contentType?: string;
  state?: string;
  public?: boolean;
  output?: string;
}

// Local interface for object data used in this component
interface ObjectListItem {
  id: string;
  name?: string;
  content_type?: string;
  size_bytes?: number;
  state?: string;
  is_public?: boolean;
  create_time_ms?: number;
  delete_after_time_ms?: number | null;
  [key: string]: unknown;
}

const DEFAULT_PAGE_SIZE = 10;

const ListObjectsUI = ({
  onBack,
  onExit,
}: {
  onBack?: () => void;
  onExit?: () => void;
}) => {
  const { exit: inkExit } = useApp();
  const { navigate } = useNavigation();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showPopup, setShowPopup] = React.useState(false);
  const [selectedOperation, setSelectedOperation] = React.useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedObject, setSelectedObject] = React.useState<any | null>(null);
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
  const [showDownloadPrompt, setShowDownloadPrompt] = React.useState(false);
  const [downloadPath, setDownloadPath] = React.useState("");
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
  const stateWidth = 12;
  const typeWidth = 15;
  const sizeWidth = 12;
  const timeWidth = 20;
  const ttlWidth = 14;
  const showTypeColumn = terminalWidth >= 100;
  const showSizeColumn = terminalWidth >= 90;
  const showTtlColumn = terminalWidth >= 80;

  // Name width uses remaining space after fixed columns
  const baseWidth = fixedWidth + idWidth + stateWidth + timeWidth;
  const optionalWidth =
    (showTypeColumn ? typeWidth : 0) +
    (showSizeColumn ? sizeWidth : 0) +
    (showTtlColumn ? ttlWidth : 0);
  const remainingWidth = terminalWidth - baseWidth - optionalWidth;
  const nameWidth = Math.min(80, Math.max(15, remainingWidth));

  // Helper to format TTL remaining time
  const formatTtl = (deleteAfterMs?: number | null): string => {
    if (!deleteAfterMs) return "";
    const now = Date.now();
    const remainingMs = deleteAfterMs - now;
    if (remainingMs <= 0) return "Expired";
    const remainingMinutes = Math.floor(remainingMs / 60000);
    if (remainingMinutes < 60) {
      return `${remainingMinutes}m left`;
    }
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;
    if (hours < 24) {
      return `${hours}h ${mins}m left`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h left`;
  };

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const client = getClient();
      const pageObjects: ObjectListItem[] = [];

      // Build query params
      const queryParams: Record<string, unknown> = {
        limit: params.limit,
      };
      if (params.startingAt) {
        queryParams.starting_after = params.startingAt;
      }
      if (search.submittedSearchQuery) {
        queryParams.search = search.submittedSearchQuery;
      }

      // Fetch ONE page only
      const result = await client.objects.list(queryParams);

      // Extract data and create defensive copies
      if (result.objects && Array.isArray(result.objects)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result.objects.forEach((obj: any) => {
          pageObjects.push({
            id: obj.id,
            name: obj.name,
            content_type: obj.content_type,
            size_bytes: obj.size_bytes,
            state: obj.state,
            is_public: obj.is_public,
            create_time_ms: obj.create_time_ms,
            delete_after_time_ms: obj.delete_after_time_ms,
          });
        });
      }

      // Access pagination properties from the result
      const pageResult = result as unknown as {
        objects: unknown[];
        has_more?: boolean;
      };

      return {
        items: pageObjects,
        hasMore: pageResult.has_more || false,
        totalCount: pageObjects.length,
      };
    },
    [search.submittedSearchQuery],
  );

  // Use the shared pagination hook
  const {
    items: objects,
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
    getItemId: (obj: ObjectListItem) => obj.id,
    pollInterval: 2000,
    pollingEnabled:
      !showPopup &&
      !executingOperation &&
      !showDownloadPrompt &&
      !showDeleteConfirm &&
      !search.searchMode,
    deps: [PAGE_SIZE, search.submittedSearchQuery],
  });

  // Operations for objects
  const operations: Operation[] = React.useMemo(
    () => [
      {
        key: "view_details",
        label: "View Details",
        color: colors.primary,
        icon: figures.pointer,
      },
      {
        key: "download",
        label: "Download",
        color: colors.success,
        icon: figures.arrowDown,
      },
      {
        key: "delete",
        label: "Delete",
        color: colors.error,
        icon: figures.cross,
      },
    ],
    [],
  );

  // Build columns
  const columns = React.useMemo(
    () => [
      createTextColumn("id", "ID", (obj: ObjectListItem) => obj.id, {
        width: idWidth + 1,
        color: colors.idColor,
        dimColor: false,
        bold: false,
      }),
      createTextColumn(
        "name",
        "Name",
        (obj: ObjectListItem) => obj.name || "",
        {
          width: nameWidth,
        },
      ),
      createTextColumn(
        "state",
        "State",
        (obj: ObjectListItem) => obj.state || "",
        {
          width: stateWidth,
          color: colors.warning,
          dimColor: false,
          bold: false,
        },
      ),
      createTextColumn(
        "type",
        "Type",
        (obj: ObjectListItem) => obj.content_type || "",
        {
          width: typeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
          visible: showTypeColumn,
        },
      ),
      createTextColumn(
        "size",
        "Size",
        (obj: ObjectListItem) => formatFileSize(obj.size_bytes),
        {
          width: sizeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
          visible: showSizeColumn,
        },
      ),
      createTextColumn(
        "created",
        "Created",
        (obj: ObjectListItem) =>
          obj.create_time_ms ? formatTimeAgo(obj.create_time_ms) : "",
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
      createTextColumn(
        "ttl",
        "Expires",
        (obj: ObjectListItem) => formatTtl(obj.delete_after_time_ms),
        {
          width: ttlWidth,
          color: colors.warning,
          dimColor: false,
          bold: false,
          visible: showTtlColumn,
        },
      ),
    ],
    [
      idWidth,
      nameWidth,
      stateWidth,
      typeWidth,
      sizeWidth,
      timeWidth,
      ttlWidth,
      showTypeColumn,
      showSizeColumn,
      showTtlColumn,
      formatTtl,
    ],
  );

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (objects.length > 0 && selectedIndex >= objects.length) {
      setSelectedIndex(Math.max(0, objects.length - 1));
    }
  }, [objects.length, selectedIndex]);

  const selectedObjectItem = objects[selectedIndex];

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + objects.length;

  const executeOperation = async (
    obj: ObjectListItem,
    operationKey: string,
    targetPath?: string,
  ) => {
    const client = getClient();

    if (!obj) return;

    try {
      setOperationLoading(true);
      switch (operationKey) {
        case "delete":
          await client.objects.delete(obj.id);
          setOperationResult(`Storage object ${obj.id} deleted successfully`);
          break;
        case "download": {
          if (!targetPath) {
            setOperationError(new Error("No download path specified"));
            break;
          }
          // Get download URL
          const downloadUrlResponse = await client.objects.download(obj.id, {
            duration_seconds: 3600,
          });
          // Download the file
          const response = await fetch(downloadUrlResponse.download_url);
          if (!response.ok) {
            throw new Error(`Download failed: HTTP ${response.status}`);
          }
          // Save the file
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await writeFile(targetPath, buffer);
          setOperationResult(`Downloaded to ${targetPath}`);
          break;
        }
      }
    } catch (err) {
      setOperationError(err as Error);
    } finally {
      setOperationLoading(false);
    }
  };

  // Handle download submission
  const handleDownloadSubmit = () => {
    if (downloadPath.trim() && selectedObject) {
      setShowDownloadPrompt(false);
      setExecutingOperation("download");
      executeOperation(selectedObject, "download", downloadPath.trim());
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
        setSelectedObject(null);
        // Refresh the list after delete to show updated data
        // Use setTimeout to ensure state updates are applied first
        if (wasDelete && !hadError) {
          setTimeout(() => refresh(), 0);
        }
      }
      return;
    }

    // Handle download prompt
    if (showDownloadPrompt) {
      if (key.escape) {
        setShowDownloadPrompt(false);
        setDownloadPath("");
        setSelectedObject(null);
      } else if (key.return) {
        handleDownloadSubmit();
      }
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
          navigate("object-detail", {
            objectId: selectedObjectItem.id,
          });
        } else if (operationKey === "download") {
          // Show download prompt
          setSelectedObject(selectedObjectItem);
          const defaultName = selectedObjectItem.name || selectedObjectItem.id;
          setDownloadPath(`./${defaultName}`);
          setShowDownloadPrompt(true);
        } else if (operationKey === "delete") {
          // Show delete confirmation
          setSelectedObject(selectedObjectItem);
          setShowDeleteConfirm(true);
        } else {
          setSelectedObject(selectedObjectItem);
          setExecutingOperation(operationKey);
          // Execute immediately with the object and operation passed directly
          executeOperation(selectedObjectItem, operationKey);
        }
      } else if (input === "v" && selectedObjectItem) {
        // View details hotkey
        setShowPopup(false);
        navigate("object-detail", {
          objectId: selectedObjectItem.id,
        });
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (input === "w") {
        // Download hotkey - show prompt
        setShowPopup(false);
        setSelectedObject(selectedObjectItem);
        const defaultName = selectedObjectItem.name || selectedObjectItem.id;
        setDownloadPath(`./${defaultName}`);
        setShowDownloadPrompt(true);
      } else if (input === "d") {
        // Delete hotkey - show confirmation
        setShowPopup(false);
        setSelectedObject(selectedObjectItem);
        setShowDeleteConfirm(true);
      }
      return;
    }

    const pageObjects = objects.length;

    // Handle list view navigation
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageObjects - 1) {
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
    } else if (key.return && selectedObjectItem) {
      // Enter key navigates to detail view
      navigate("object-detail", {
        objectId: selectedObjectItem.id,
      });
    } else if (input === "a" && selectedObjectItem) {
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
            { label: "Storage Objects" },
            {
              label: selectedObject?.name || selectedObject?.id || "Object",
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

  // Download prompt
  if (showDownloadPrompt && selectedObject) {
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Storage Objects" },
            { label: selectedObject.name || selectedObject.id },
            { label: "Download", active: true },
          ]}
        />
        <Header title="Download Storage Object" />
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.text}>
            {figures.arrowRight} Downloading:{" "}
            <Text color={colors.primary}>
              {selectedObject.name || selectedObject.id}
            </Text>
          </Text>
          {selectedObject.size_bytes && (
            <Text color={colors.textDim} dimColor>
              {figures.info} Size: {formatFileSize(selectedObject.size_bytes)}
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
        <NavigationTips
          tips={[
            { key: "Enter", label: "Download" },
            { key: "Esc", label: "Cancel" },
          ]}
        />
      </>
    );
  }

  // Delete confirmation
  if (showDeleteConfirm && selectedObject) {
    return (
      <ConfirmationPrompt
        title="Delete Storage Object"
        message={`Are you sure you want to delete "${selectedObject.name || selectedObject.id}"?`}
        details="This action cannot be undone."
        breadcrumbItems={[
          { label: "Storage Objects" },
          { label: selectedObject.name || selectedObject.id },
          { label: "Delete", active: true },
        ]}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          setExecutingOperation("delete");
          executeOperation(selectedObject, "delete");
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSelectedObject(null);
        }}
      />
    );
  }

  // Operation loading state
  if (operationLoading && selectedObject) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label ||
      "Operation";
    const messages: Record<string, string> = {
      delete: "Deleting storage object...",
      download: "Downloading...",
    };
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Storage Objects" },
            { label: selectedObject.name || selectedObject.id },
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

  // Loading state
  if (loading && objects.length === 0) {
    return (
      <>
        <Breadcrumb items={[{ label: "Storage Objects", active: true }]} />
        <SpinnerComponent message="Loading storage objects..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb items={[{ label: "Storage Objects", active: true }]} />
        <ErrorMessage message="Failed to list storage objects" error={error} />
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb items={[{ label: "Storage Objects", active: true }]} />

      {/* Search bar */}
      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search storage objects..."
      />

      {/* Table - hide when popup is shown */}
      {!showPopup && (
        <Table
          data={objects}
          keyExtractor={(obj: ObjectListItem) => obj.id}
          selectedIndex={selectedIndex}
          title={`storage_objects[${hasMore ? `${totalCount}+` : totalCount}]`}
          columns={columns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No storage objects found. Try: rli object upload{" "}
              {"<file>"}
            </Text>
          }
        />
      )}

      {/* Statistics Bar - hide when popup is shown */}
      {!showPopup && (
        <Box marginTop={1} paddingX={1}>
          <Text color={colors.primary} bold>
            {figures.hamburger} {hasMore ? `${totalCount}+` : totalCount}
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
                  Page {currentPage + 1} of{" "}
                  {hasMore ? `${totalPages}+` : totalPages}
                </Text>
              )}
            </>
          )}
          <Text color={colors.textDim} dimColor>
            {" "}
            •{" "}
          </Text>
          <Text color={colors.textDim} dimColor>
            Showing {startIndex + 1}-{endIndex} of{" "}
            {hasMore ? `${totalCount}+` : totalCount}
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
      {showPopup && selectedObjectItem && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedObjectItem}
            operations={operations.map((op) => ({
              key: op.key,
              label: op.label,
              color: op.color,
              icon: op.icon,
              shortcut:
                op.key === "view_details"
                  ? "v"
                  : op.key === "download"
                    ? "w"
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
export { ListObjectsUI };

export async function listObjects(options: ListOptions) {
  try {
    const client = getClient();

    // Build query params
    const queryParams: Record<string, unknown> = {
      limit: DEFAULT_PAGE_SIZE,
    };
    if (options.name) {
      queryParams.name = options.name;
    }
    if (options.contentType) {
      queryParams.content_type = options.contentType;
    }
    if (options.state) {
      queryParams.state = options.state;
    }
    if (options.public !== undefined) {
      queryParams.is_public = options.public;
    }

    // Fetch objects
    const result = await client.objects.list(queryParams);

    // Extract objects array
    const objects = result.objects || [];

    output(objects, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list storage objects", error);
  }
}

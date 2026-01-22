import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
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
import { useNavigation } from "../../store/navigationStore.js";
import { formatFileSize } from "../../services/objectService.js";

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

  // Calculate overhead for viewport height
  const overhead = 13;
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  const PAGE_SIZE = viewportHeight;

  // All width constants
  const idWidth = 25;
  const nameWidth = Math.max(15, terminalWidth >= 120 ? 30 : 20);
  const typeWidth = 15;
  const sizeWidth = 12;
  const timeWidth = 15;
  const showTypeColumn = terminalWidth >= 100;
  const showSizeColumn = terminalWidth >= 80;

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
          });
        });
      }

      // Access pagination properties from the result
      const pageResult = result as unknown as {
        objects: unknown[];
        total_count?: number;
        has_more?: boolean;
      };

      return {
        items: pageObjects,
        hasMore: pageResult.has_more || false,
        totalCount: pageResult.total_count || pageObjects.length,
      };
    },
    [],
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
  } = useCursorPagination({
    fetchPage,
    pageSize: PAGE_SIZE,
    getItemId: (obj: ObjectListItem) => obj.id,
    pollInterval: 5000,
    pollingEnabled: !showPopup && !executingOperation,
    deps: [PAGE_SIZE],
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
        label: "Download Object",
        color: colors.success,
        icon: figures.arrowDown,
      },
      {
        key: "delete",
        label: "Delete Object",
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
    ],
    [
      idWidth,
      nameWidth,
      typeWidth,
      sizeWidth,
      timeWidth,
      showTypeColumn,
      showSizeColumn,
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

  const executeOperation = async () => {
    const client = getClient();
    const obj = selectedObject;

    if (!obj) return;

    try {
      setOperationLoading(true);
      switch (executingOperation) {
        case "delete":
          await client.objects.delete(obj.id);
          setOperationResult(`Object ${obj.id} deleted successfully`);
          break;
        case "download": {
          // Get download URL and open in browser
          const objDetails = await client.objects.retrieve(obj.id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const downloadUrl = (objDetails as any).download_url;
          if (downloadUrl) {
            const { exec } = await import("child_process");
            const platform = process.platform;
            let openCommand: string;
            if (platform === "darwin") {
              openCommand = `open "${downloadUrl}"`;
            } else if (platform === "win32") {
              openCommand = `start "${downloadUrl}"`;
            } else {
              openCommand = `xdg-open "${downloadUrl}"`;
            }
            exec(openCommand);
            setOperationResult(`Download started for ${obj.name || obj.id}`);
          } else {
            setOperationError(new Error("No download URL available"));
          }
          break;
        }
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
        setSelectedObject(null);
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
        } else {
          setSelectedObject(selectedObjectItem);
          setExecutingOperation(operationKey);
          // Execute immediately after state update
          setTimeout(() => executeOperation(), 0);
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
        // Download hotkey
        setShowPopup(false);
        setSelectedObject(selectedObjectItem);
        setExecutingOperation("download");
        setTimeout(() => executeOperation(), 0);
      } else if (input === "d") {
        // Delete hotkey
        setShowPopup(false);
        setSelectedObject(selectedObjectItem);
        setExecutingOperation("delete");
        setTimeout(() => executeOperation(), 0);
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
            { label: "Objects" },
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
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            Press [Enter], [q], or [esc] to continue
          </Text>
        </Box>
      </>
    );
  }

  // Operation loading state
  if (operationLoading && selectedObject) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label ||
      "Operation";
    const messages: Record<string, string> = {
      delete: "Deleting object...",
      download: "Starting download...",
    };
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Objects" },
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
        <Breadcrumb items={[{ label: "Objects", active: true }]} />
        <SpinnerComponent message="Loading objects..." />
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Breadcrumb items={[{ label: "Objects", active: true }]} />
        <ErrorMessage message="Failed to list objects" error={error} />
      </>
    );
  }

  // Main list view
  return (
    <>
      <Breadcrumb items={[{ label: "Objects", active: true }]} />

      {/* Table - hide when popup is shown */}
      {!showPopup && (
        <Table
          data={objects}
          keyExtractor={(obj: ObjectListItem) => obj.id}
          selectedIndex={selectedIndex}
          title={`objects[${totalCount}]`}
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
          • [Enter] Details
        </Text>
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
    outputError("Failed to list objects", error);
  }
}

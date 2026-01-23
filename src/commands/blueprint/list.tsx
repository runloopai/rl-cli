import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import type { BlueprintsCursorIDPage } from "@runloop/api-client/pagination";
import { getClient } from "../../utils/client.js";
import { Header } from "../../components/Header.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { SuccessMessage } from "../../components/SuccessMessage.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";
import { NavigationTips } from "../../components/NavigationTips.js";
import { createTextColumn, Table } from "../../components/Table.js";
import { Operation } from "../../components/OperationsMenu.js";
import { ActionsPopup } from "../../components/ActionsPopup.js";
import { formatTimeAgo } from "../../components/ResourceListView.js";
import { SearchBar } from "../../components/SearchBar.js";
import { output, outputError } from "../../utils/output.js";
import { getBlueprintUrl } from "../../utils/url.js";
import { colors } from "../../utils/theme.js";
import { getStatusDisplay } from "../../components/StatusBadge.js";
import { DevboxCreatePage } from "../../components/DevboxCreatePage.js";
import { useExitOnCtrlC } from "../../hooks/useExitOnCtrlC.js";
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
import { useCursorPagination } from "../../hooks/useCursorPagination.js";
import { useListSearch } from "../../hooks/useListSearch.js";
import { useNavigation } from "../../store/navigationStore.js";
import { ConfirmationPrompt } from "../../components/ConfirmationPrompt.js";

const DEFAULT_PAGE_SIZE = 10;

type OperationType =
  | "create_devbox"
  | "delete"
  | "view_logs"
  | "view_details"
  | null;

// Local interface for blueprint data used in this component
interface BlueprintListItem {
  id: string;
  name?: string;
  status?: string;
  create_time_ms?: number;
  [key: string]: unknown;
}

const ListBlueprintsUI = ({
  onBack,
  onExit,
}: {
  onBack?: () => void;
  onExit?: () => void;
}) => {
  const { exit: inkExit } = useApp();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedBlueprint, setSelectedBlueprint] = React.useState<any | null>(
    null,
  );
  const [selectedOperation, setSelectedOperation] = React.useState(0);
  const [executingOperation, setExecutingOperation] =
    React.useState<OperationType>(null);
  const [operationInput, setOperationInput] = React.useState("");
  const [operationResult, setOperationResult] = React.useState<string | null>(
    null,
  );
  const [operationError, setOperationError] = React.useState<Error | null>(
    null,
  );
  const [operationLoading, setOperationLoading] = React.useState(false);
  const [showCreateDevbox, setShowCreateDevbox] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showPopup, setShowPopup] = React.useState(false);
  const { navigate } = useNavigation();

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
  const statusIconWidth = 2;
  const statusTextWidth = 10;
  const idWidth = 25;
  const descriptionWidth = 40;
  const timeWidth = 20;
  const showDescription = terminalWidth >= 120;

  // Name width uses remaining space after fixed columns
  const baseWidth =
    fixedWidth + statusIconWidth + statusTextWidth + idWidth + timeWidth;
  const optionalWidth = showDescription ? descriptionWidth : 0;
  const remainingWidth = terminalWidth - baseWidth - optionalWidth;
  const nameWidth = Math.min(80, Math.max(15, remainingWidth));

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const client = getClient();
      const pageBlueprints: BlueprintListItem[] = [];

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
      const page = (await client.blueprints.list(
        queryParams,
      )) as unknown as BlueprintsCursorIDPage<BlueprintListItem>;

      // Extract data and create defensive copies
      if (page.blueprints && Array.isArray(page.blueprints)) {
        page.blueprints.forEach((b: BlueprintListItem) => {
          pageBlueprints.push({
            id: b.id,
            name: b.name,
            status: b.status,
            create_time_ms: b.create_time_ms,
          });
        });
      }

      const result = {
        items: pageBlueprints,
        hasMore: page.has_more || false,
        totalCount: page.total_count || pageBlueprints.length,
      };

      return result;
    },
    [search.submittedSearchQuery],
  );

  // Use the shared pagination hook
  const {
    items: blueprints,
    loading,
    navigating,
    error: listError,
    currentPage,
    hasMore,
    hasPrev,
    totalCount,
    nextPage,
    prevPage,
  } = useCursorPagination({
    fetchPage,
    pageSize: PAGE_SIZE,
    getItemId: (blueprint: BlueprintListItem) => blueprint.id,
    pollInterval: 2000,
    pollingEnabled:
      !showPopup &&
      !showCreateDevbox &&
      !executingOperation &&
      !showDeleteConfirm &&
      !search.searchMode,
    deps: [PAGE_SIZE, search.submittedSearchQuery],
  });

  // Memoize columns array
  const blueprintColumns = React.useMemo(
    () => [
      {
        key: "statusIcon",
        label: "",
        width: statusIconWidth,
        render: (
          blueprint: BlueprintListItem,
          _index: number,
          isSelected: boolean,
        ) => {
          const statusDisplay = getStatusDisplay(blueprint.status || "");
          return (
            <Text
              color={isSelected ? "white" : statusDisplay.color}
              bold={true}
              dimColor={false}
              inverse={isSelected}
              wrap="truncate"
            >
              {statusDisplay.icon}{" "}
            </Text>
          );
        },
      },
      {
        key: "id",
        label: "ID",
        width: idWidth + 1,
        render: (
          blueprint: BlueprintListItem,
          _index: number,
          isSelected: boolean,
        ) => {
          const value = blueprint.id;
          const width = Math.max(1, idWidth + 1);
          const truncated = value.slice(0, Math.max(1, width - 1));
          const padded = truncated.padEnd(width, " ");
          return (
            <Text
              color={isSelected ? "white" : colors.idColor}
              bold={false}
              dimColor={false}
              inverse={isSelected}
              wrap="truncate"
            >
              {padded}
            </Text>
          );
        },
      },
      {
        key: "statusText",
        label: "Status",
        width: statusTextWidth,
        render: (
          blueprint: BlueprintListItem,
          _index: number,
          isSelected: boolean,
        ) => {
          const statusDisplay = getStatusDisplay(blueprint.status || "");
          const safeWidth = Math.max(1, statusTextWidth);
          const truncated = statusDisplay.text.slice(0, safeWidth);
          const padded = truncated.padEnd(safeWidth, " ");
          return (
            <Text
              color={isSelected ? "white" : statusDisplay.color}
              bold={true}
              dimColor={false}
              inverse={isSelected}
              wrap="truncate"
            >
              {padded}
            </Text>
          );
        },
      },
      createTextColumn(
        "name",
        "Name",
        (blueprint: BlueprintListItem) => blueprint.name || "",
        {
          width: nameWidth,
        },
      ),
      // Description column removed - not available in API
      createTextColumn(
        "created",
        "Created",
        (blueprint: BlueprintListItem) =>
          blueprint.create_time_ms
            ? formatTimeAgo(blueprint.create_time_ms)
            : "",
        {
          width: timeWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
        },
      ),
    ],
    [
      statusIconWidth,
      statusTextWidth,
      idWidth,
      nameWidth,
      descriptionWidth,
      timeWidth,
      showDescription,
    ],
  );

  // Helper function to generate operations based on selected blueprint
  const getOperationsForBlueprint = (
    blueprint: BlueprintListItem,
  ): Operation[] => {
    const operations: Operation[] = [];

    // View Details is always first
    operations.push({
      key: "view_details",
      label: "View Details",
      color: colors.primary,
      icon: figures.pointer,
    });

    // View Logs is always available
    operations.push({
      key: "view_logs",
      label: "View Logs",
      color: colors.info,
      icon: figures.info,
    });

    if (
      blueprint &&
      (blueprint.status === "build_complete" ||
        blueprint.status === "building_complete")
    ) {
      operations.push({
        key: "create_devbox",
        label: "Create Devbox from Blueprint",
        color: colors.success,
        icon: figures.play,
      });
    }

    operations.push({
      key: "delete",
      label: "Delete Blueprint",
      color: colors.error,
      icon: figures.cross,
    });

    return operations;
  };

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Ensure selected index is within bounds
  React.useEffect(() => {
    if (blueprints.length > 0 && selectedIndex >= blueprints.length) {
      setSelectedIndex(Math.max(0, blueprints.length - 1));
    }
  }, [blueprints.length, selectedIndex]);

  const selectedBlueprintItem = blueprints[selectedIndex];
  const allOperations = getOperationsForBlueprint(selectedBlueprintItem);

  // Calculate pagination info for display
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const startIndex = currentPage * PAGE_SIZE;
  const endIndex = startIndex + blueprints.length;

  const executeOperation = async (
    blueprintOverride?: BlueprintListItem,
    operationOverride?: OperationType,
  ) => {
    const client = getClient();
    // Use override if provided, otherwise use selectedBlueprint from state
    // If neither is available, use selectedBlueprintItem as fallback
    const blueprint =
      blueprintOverride || selectedBlueprint || selectedBlueprintItem;
    // Use operation override if provided (to avoid state timing issues)
    const operation = operationOverride || executingOperation;

    if (!blueprint) {
      console.error("No blueprint selected for operation");
      return;
    }

    // Ensure selectedBlueprint is set in state if it wasn't already
    if (!selectedBlueprint && blueprint) {
      setSelectedBlueprint(blueprint);
    }

    try {
      setOperationLoading(true);
      switch (operation) {
        case "view_details":
          // Navigate to the detail screen
          setOperationLoading(false);
          setExecutingOperation(null);
          navigate("blueprint-detail", {
            blueprintId: blueprint.id,
          });
          return;

        case "view_logs":
          // Navigate to the logs screen
          setOperationLoading(false);
          setExecutingOperation(null);
          navigate("blueprint-logs", {
            blueprintId: blueprint.id,
            blueprintName: blueprint.name || blueprint.id,
          });
          return;

        case "create_devbox":
          setShowCreateDevbox(true);
          setExecutingOperation(null);
          setOperationLoading(false);
          return;

        case "delete":
          await client.blueprints.delete(blueprint.id);
          setOperationResult(`Blueprint ${blueprint.id} deleted successfully`);
          break;
      }
    } catch (err) {
      setOperationError(err as Error);
    } finally {
      setOperationLoading(false);
    }
  };

  // Filter operations based on blueprint status
  const operations = selectedBlueprint
    ? allOperations.filter((op) => {
        const status = selectedBlueprint.status;
        if (op.key === "create_devbox") {
          return status === "build_complete";
        }
        return true;
      })
    : allOperations;

  // Handle input for all views
  useInput((input, key) => {
    // Handle search mode input
    if (search.searchMode) {
      if (key.escape) {
        search.cancelSearch();
      }
      return;
    }

    // Handle operation input mode
    if (executingOperation && !operationResult && !operationError) {
      // Allow escape/q to cancel any operation, even during loading
      if (input === "q" || key.escape) {
        setExecutingOperation(null);
        setOperationInput("");
        setOperationLoading(false);
        return;
      }

      const currentOp = allOperations.find(
        (op) => op.key === executingOperation,
      );
      if (currentOp?.needsInput) {
        if (key.return) {
          executeOperation();
        }
      }
      return;
    }

    // Handle operation result display
    if (operationResult || operationError) {
      if (input === "q" || key.escape || key.return) {
        setOperationResult(null);
        setOperationError(null);
        setExecutingOperation(null);
        setOperationInput("");
      }
      return;
    }

    // Handle create devbox view
    if (showCreateDevbox) {
      return;
    }

    // Handle actions popup overlay
    if (showPopup) {
      if (key.upArrow && selectedOperation > 0) {
        setSelectedOperation(selectedOperation - 1);
      } else if (
        key.downArrow &&
        selectedOperation < allOperations.length - 1
      ) {
        setSelectedOperation(selectedOperation + 1);
      } else if (key.return) {
        setShowPopup(false);
        const operationKey = allOperations[selectedOperation].key;

        if (operationKey === "view_details") {
          navigate("blueprint-detail", {
            blueprintId: selectedBlueprintItem.id,
          });
        } else if (operationKey === "create_devbox") {
          setSelectedBlueprint(selectedBlueprintItem);
          setShowCreateDevbox(true);
        } else if (operationKey === "delete") {
          // Show delete confirmation
          setSelectedBlueprint(selectedBlueprintItem);
          setShowDeleteConfirm(true);
        } else {
          setSelectedBlueprint(selectedBlueprintItem);
          setExecutingOperation(operationKey as OperationType);
          executeOperation(
            selectedBlueprintItem,
            operationKey as OperationType,
          );
        }
      } else if (input === "v" && selectedBlueprintItem) {
        // View details hotkey
        setShowPopup(false);
        navigate("blueprint-detail", {
          blueprintId: selectedBlueprintItem.id,
        });
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (input === "c") {
        if (
          selectedBlueprintItem &&
          (selectedBlueprintItem.status === "build_complete" ||
            selectedBlueprintItem.status === "building_complete")
        ) {
          setShowPopup(false);
          setSelectedBlueprint(selectedBlueprintItem);
          setShowCreateDevbox(true);
        }
      } else if (input === "d") {
        const deleteIndex = allOperations.findIndex(
          (op) => op.key === "delete",
        );
        if (deleteIndex >= 0) {
          // Show delete confirmation
          setShowPopup(false);
          setSelectedBlueprint(selectedBlueprintItem);
          setShowDeleteConfirm(true);
        }
      } else if (input === "l") {
        const logsIndex = allOperations.findIndex(
          (op) => op.key === "view_logs",
        );
        if (logsIndex >= 0) {
          setShowPopup(false);
          setSelectedBlueprint(selectedBlueprintItem);
          setExecutingOperation("view_logs");
          executeOperation(selectedBlueprintItem, "view_logs");
        }
      }
      return;
    }

    // Handle list navigation
    const pageBlueprints = blueprints.length;

    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageBlueprints - 1) {
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
    } else if (key.return && selectedBlueprintItem) {
      // Enter key navigates to detail view
      navigate("blueprint-detail", {
        blueprintId: selectedBlueprintItem.id,
      });
    } else if (input === "a") {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "l" && selectedBlueprintItem) {
      setSelectedBlueprint(selectedBlueprintItem);
      setExecutingOperation("view_logs");
      executeOperation(selectedBlueprintItem, "view_logs");
    } else if (input === "o" && blueprints[selectedIndex]) {
      const url = getBlueprintUrl(blueprints[selectedIndex].id);
      const openBrowser = async () => {
        const { exec } = await import("child_process");
        const platform = process.platform;
        let openCommand: string;
        if (platform === "darwin") {
          openCommand = `open "${url}"`;
        } else if (platform === "win32") {
          openCommand = `start "${url}"`;
        } else {
          openCommand = `xdg-open "${url}"`;
        }
        exec(openCommand);
      };
      openBrowser();
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

  // Delete confirmation
  if (showDeleteConfirm && selectedBlueprint) {
    return (
      <ConfirmationPrompt
        title="Delete Blueprint"
        message={`Are you sure you want to delete "${selectedBlueprint.name || selectedBlueprint.id}"?`}
        details="This action cannot be undone."
        breadcrumbItems={[
          { label: "Blueprints" },
          { label: selectedBlueprint.name || selectedBlueprint.id },
          { label: "Delete", active: true },
        ]}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          setExecutingOperation("delete");
          executeOperation(selectedBlueprint, "delete");
        }}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setSelectedBlueprint(null);
        }}
      />
    );
  }

  // Operation result display
  if (operationResult || operationError) {
    const operationLabel =
      operations.find((o) => o.key === executingOperation)?.label ||
      "Operation";
    return (
      <>
        <Breadcrumb
          items={[
            { label: "Blueprints" },
            {
              label:
                selectedBlueprint?.name || selectedBlueprint?.id || "Blueprint",
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

  // Operation input mode
  if (executingOperation && selectedBlueprint) {
    const currentOp = allOperations.find((op) => op.key === executingOperation);
    const needsInput = currentOp?.needsInput;
    const operationLabel = currentOp?.label || "Operation";

    if (operationLoading) {
      const messages: Record<string, string> = {
        delete: "Deleting blueprint...",
        view_logs: "Fetching logs...",
      };
      return (
        <>
          <Breadcrumb
            items={[
              { label: "Blueprints" },
              { label: selectedBlueprint.name || selectedBlueprint.id },
              { label: operationLabel, active: true },
            ]}
          />
          <Header title="Executing Operation" />
          <SpinnerComponent
            message={messages[executingOperation as string] || "Please wait..."}
          />
          <Box marginTop={1} paddingX={1}>
            <Text color={colors.textDim} dimColor>
              Press [q] or [esc] to cancel
            </Text>
          </Box>
        </>
      );
    }

    // Only show input screen if operation needs input
    // Operations like view_logs navigate away and don't need this screen
    if (needsInput) {
      return (
        <>
          <Breadcrumb
            items={[
              { label: "Blueprints" },
              { label: selectedBlueprint.name || selectedBlueprint.id },
              { label: operationLabel, active: true },
            ]}
          />
          <Header title={operationLabel} />
          <Box flexDirection="column" marginBottom={1}>
            <Box marginBottom={1}>
              <Text color={colors.primary} bold>
                {selectedBlueprint.name || selectedBlueprint.id}
              </Text>
            </Box>
            <Box>
              <Text color={colors.textDim}>
                {currentOp?.inputPrompt || ""}{" "}
              </Text>
            </Box>
            <Box marginTop={1}>
              <TextInput
                value={operationInput}
                onChange={setOperationInput}
                placeholder={currentOp?.inputPlaceholder || ""}
              />
            </Box>
            <NavigationTips
              marginTop={1}
              paddingX={0}
              tips={[
                { key: "Enter", label: "Execute" },
                { key: "q/esc", label: "Cancel" },
              ]}
            />
          </Box>
        </>
      );
    }
    // For operations that don't need input (like view_logs), fall through to list view
  }

  // Create devbox screen
  if (showCreateDevbox && selectedBlueprint) {
    return (
      <DevboxCreatePage
        onBack={() => {
          setShowCreateDevbox(false);
          setSelectedBlueprint(null);
        }}
        onCreate={(devbox) => {
          setShowCreateDevbox(false);
          setSelectedBlueprint(null);
          navigate("devbox-detail", { devboxId: devbox.id });
        }}
        initialBlueprintId={selectedBlueprint.id}
      />
    );
  }

  // Loading state
  if (loading && blueprints.length === 0) {
    return (
      <>
        <Breadcrumb items={[{ label: "Blueprints", active: true }]} />
        <SpinnerComponent message="Loading blueprints..." />
      </>
    );
  }

  // Error state
  if (listError) {
    return (
      <>
        <Breadcrumb items={[{ label: "Blueprints", active: true }]} />
        <ErrorMessage message="Failed to load blueprints" error={listError} />
      </>
    );
  }

  // List view
  return (
    <>
      <Breadcrumb items={[{ label: "Blueprints", active: true }]} />

      {/* Search bar */}
      <SearchBar
        searchMode={search.searchMode}
        searchQuery={search.searchQuery}
        submittedSearchQuery={search.submittedSearchQuery}
        resultCount={totalCount}
        onSearchChange={search.setSearchQuery}
        onSearchSubmit={search.submitSearch}
        placeholder="Search blueprints..."
      />

      {/* Table */}
      {!showPopup && (
        <Table
          data={blueprints}
          keyExtractor={(blueprint: BlueprintListItem) => blueprint.id}
          selectedIndex={selectedIndex}
          title={`blueprints[${totalCount}]`}
          columns={blueprintColumns}
          emptyState={
            <Text color={colors.textDim}>
              {figures.info} No blueprints found. Try: rli blueprint create
            </Text>
          }
        />
      )}

      {/* Statistics Bar */}
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
      {showPopup && selectedBlueprintItem && (
        <Box marginTop={2} justifyContent="center">
          <ActionsPopup
            devbox={selectedBlueprintItem}
            operations={allOperations.map((op) => ({
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
                      : op.key === "view_logs"
                        ? "l"
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
          { key: "o", label: "Browser" },
          { key: "/", label: "Search" },
          { key: "Esc", label: "Back" },
        ]}
      />
    </>
  );
};

interface ListBlueprintsOptions {
  name?: string;
  output?: string;
}

// Export the UI component for use in the main menu
export { ListBlueprintsUI };

export async function listBlueprints(options: ListBlueprintsOptions = {}) {
  try {
    const client = getClient();

    // Build query params
    const queryParams: Record<string, unknown> = {
      limit: DEFAULT_PAGE_SIZE,
    };
    if (options.name) {
      queryParams.name = options.name;
    }

    // Fetch blueprints
    const page = (await client.blueprints.list(
      queryParams,
    )) as BlueprintsCursorIDPage<{ id: string }>;

    // Extract blueprints array
    const blueprints = page.blueprints || [];

    output(blueprints, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list blueprints", error);
  }
}

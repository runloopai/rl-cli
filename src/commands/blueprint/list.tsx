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
import { createTextColumn, Table } from "../../components/Table.js";
import { Operation } from "../../components/OperationsMenu.js";
import { ActionsPopup } from "../../components/ActionsPopup.js";
import { formatTimeAgo } from "../../components/ResourceListView.js";
import { output, outputError } from "../../utils/output.js";
import { getBlueprintUrl } from "../../utils/url.js";
import { colors } from "../../utils/theme.js";
import { getStatusDisplay } from "../../components/StatusBadge.js";
import { DevboxCreatePage } from "../../components/DevboxCreatePage.js";
import { useExitOnCtrlC } from "../../hooks/useExitOnCtrlC.js";
import { useViewportHeight } from "../../hooks/useViewportHeight.js";
import { useCursorPagination } from "../../hooks/useCursorPagination.js";

const DEFAULT_PAGE_SIZE = 10;

type OperationType = "create_devbox" | "delete" | null;

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
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showPopup, setShowPopup] = React.useState(false);

  // Calculate overhead for viewport height
  const overhead = 13;
  const { viewportHeight, terminalWidth } = useViewportHeight({
    overhead,
    minHeight: 5,
  });

  const PAGE_SIZE = viewportHeight;

  // All width constants
  const statusIconWidth = 2;
  const statusTextWidth = 10;
  const idWidth = 25;
  const nameWidth = Math.max(15, terminalWidth >= 120 ? 30 : 25);
  const descriptionWidth = 40;
  const timeWidth = 20;
  const showDescription = terminalWidth >= 120;

  // Fetch function for pagination hook
  const fetchPage = React.useCallback(
    async (params: { limit: number; startingAt?: string }) => {
      const client = getClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pageBlueprints: any[] = [];

      // Build query params
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const queryParams: any = {
        limit: params.limit,
      };
      if (params.startingAt) {
        queryParams.starting_after = params.startingAt;
      }

      // Fetch ONE page only
      let page = (await client.blueprints.list(
        queryParams,
      )) as BlueprintsCursorIDPage<{ id: string }>;

      // Extract data and create defensive copies
      if (page.blueprints && Array.isArray(page.blueprints)) {
        page.blueprints.forEach((b: any) => {
          pageBlueprints.push({
            id: b.id,
            name: b.name,
            status: b.status,
            create_time_ms: b.create_time_ms,
            dockerfile_setup: b.dockerfile_setup
              ? { ...b.dockerfile_setup }
              : undefined,
          });
        });
      }

      const result = {
        items: pageBlueprints,
        hasMore: page.has_more || false,
        totalCount: page.total_count || pageBlueprints.length,
      };

      // Help GC
      page = null as any;

      return result;
    },
    [],
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
    getItemId: (blueprint: any) => blueprint.id,
    pollInterval: 2000,
    pollingEnabled: !showPopup && !showCreateDevbox && !executingOperation,
    deps: [PAGE_SIZE],
  });

  // Memoize columns array
  const blueprintColumns = React.useMemo(
    () => [
      {
        key: "statusIcon",
        label: "",
        width: statusIconWidth,
        render: (blueprint: any, index: number, isSelected: boolean) => {
          const statusDisplay = getStatusDisplay(blueprint.status);
          const statusColor =
            statusDisplay.color === colors.textDim
              ? colors.info
              : statusDisplay.color;
          return (
            <Text
              color={isSelected ? "white" : statusColor}
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
        render: (blueprint: any, index: number, isSelected: boolean) => {
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
        render: (blueprint: any, index: number, isSelected: boolean) => {
          const statusDisplay = getStatusDisplay(blueprint.status);
          const statusColor =
            statusDisplay.color === colors.textDim
              ? colors.info
              : statusDisplay.color;
          const safeWidth = Math.max(1, statusTextWidth);
          const truncated = statusDisplay.text.slice(0, safeWidth);
          const padded = truncated.padEnd(safeWidth, " ");
          return (
            <Text
              color={isSelected ? "white" : statusColor}
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
        (blueprint: any) => blueprint.name || "(unnamed)",
        {
          width: nameWidth,
        },
      ),
      createTextColumn(
        "description",
        "Description",
        (blueprint: any) => blueprint.dockerfile_setup?.description || "",
        {
          width: descriptionWidth,
          color: colors.textDim,
          dimColor: false,
          bold: false,
          visible: showDescription,
        },
      ),
      createTextColumn(
        "created",
        "Created",
        (blueprint: any) =>
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
  const getOperationsForBlueprint = (blueprint: any): Operation[] => {
    const operations: Operation[] = [];

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

  const executeOperation = async () => {
    const client = getClient();
    const blueprint = selectedBlueprint;

    if (!blueprint) return;

    try {
      setOperationLoading(true);
      switch (executingOperation) {
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
    // Handle operation input mode
    if (executingOperation && !operationResult && !operationError) {
      const currentOp = allOperations.find(
        (op) => op.key === executingOperation,
      );
      if (currentOp?.needsInput) {
        if (key.return) {
          executeOperation();
        } else if (input === "q" || key.escape) {
          setExecutingOperation(null);
          setOperationInput("");
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

        if (operationKey === "create_devbox") {
          setSelectedBlueprint(selectedBlueprintItem);
          setShowCreateDevbox(true);
        } else {
          setSelectedBlueprint(selectedBlueprintItem);
          setExecutingOperation(operationKey as OperationType);
          executeOperation();
        }
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
          setShowPopup(false);
          setSelectedBlueprint(selectedBlueprintItem);
          setExecutingOperation("delete");
          executeOperation();
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
    } else if (input === "a") {
      setShowPopup(true);
      setSelectedOperation(0);
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
        <Box marginTop={1}>
          <Text color={colors.textDim} dimColor>
            Press [Enter], [q], or [esc] to continue
          </Text>
        </Box>
      </>
    );
  }

  // Operation input mode
  if (executingOperation && selectedBlueprint) {
    const currentOp = allOperations.find((op) => op.key === executingOperation);
    const needsInput = currentOp?.needsInput;
    const operationLabel = currentOp?.label || "Operation";

    if (operationLoading) {
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
          <SpinnerComponent message="Please wait..." />
        </>
      );
    }

    if (!needsInput) {
      const messages: Record<string, string> = {
        delete: "Deleting blueprint...",
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
        </>
      );
    }

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
            <Text color={colors.textDim}>{currentOp.inputPrompt} </Text>
          </Box>
          <Box marginTop={1}>
            <TextInput
              value={operationInput}
              onChange={setOperationInput}
              placeholder={currentOp.inputPlaceholder || ""}
            />
          </Box>
          <Box marginTop={1}>
            <Text color={colors.textDim} dimColor>
              Press [Enter] to execute • [q or esc] Cancel
            </Text>
          </Box>
        </Box>
      </>
    );
  }

  // Create devbox screen
  if (showCreateDevbox && selectedBlueprint) {
    return (
      <DevboxCreatePage
        onBack={() => {
          setShowCreateDevbox(false);
          setSelectedBlueprint(null);
        }}
        onCreate={() => {
          setShowCreateDevbox(false);
          setSelectedBlueprint(null);
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

  // Empty state
  if (blueprints.length === 0) {
    return (
      <>
        <Breadcrumb items={[{ label: "Blueprints", active: true }]} />
        <Box>
          <Text color={colors.warning}>{figures.info}</Text>
          <Text> No blueprints found. Try: </Text>
          <Text color={colors.primary} bold>
            rli blueprint create
          </Text>
        </Box>
      </>
    );
  }

  // List view
  return (
    <>
      <Breadcrumb items={[{ label: "Blueprints", active: true }]} />

      {/* Table */}
      {!showPopup && (
        <Table
          data={blueprints}
          keyExtractor={(blueprint: any) => blueprint.id}
          selectedIndex={selectedIndex}
          title={`blueprints[${totalCount}]`}
          columns={blueprintColumns}
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
                op.key === "create_devbox"
                  ? "c"
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
          • [a] Actions
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          • [o] Browser
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          • [Esc] Back
        </Text>
      </Box>
    </>
  );
};

interface ListBlueprintsOptions {
  output?: string;
}

// Export the UI component for use in the main menu
export { ListBlueprintsUI };

export async function listBlueprints(options: ListBlueprintsOptions = {}) {
  try {
    const client = getClient();

    // Fetch blueprints
    const page = (await client.blueprints.list({
      limit: DEFAULT_PAGE_SIZE,
    })) as BlueprintsCursorIDPage<{ id: string }>;

    // Extract blueprints array
    const blueprints = page.blueprints || [];

    output(blueprints, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list blueprints", error);
  }
}

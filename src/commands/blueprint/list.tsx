import React from "react";
import { Box, Text, useInput, useStdout } from "ink";
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
import { createExecutor } from "../../utils/CommandExecutor.js";
import { getBlueprintUrl } from "../../utils/url.js";
import { colors } from "../../utils/theme.js";
import { getStatusDisplay } from "../../components/StatusBadge.js";
import { DevboxCreatePage } from "../../components/DevboxCreatePage.js";
import { exitAlternateScreenBuffer } from "../../utils/screen.js";

const PAGE_SIZE = 10;
const MAX_FETCH = 100;

type OperationType = "create_devbox" | "delete" | null;

const ListBlueprintsUI = ({
  onBack,
  onExit,
}: {
  onBack?: () => void;
  onExit?: () => void;
}) => {
  const { stdout } = useStdout();
  const isMounted = React.useRef(true);

  // Track mounted state
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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
  const [loading, setLoading] = React.useState(false);
  const [showCreateDevbox, setShowCreateDevbox] = React.useState(false);

  // List view state - moved to top to ensure hooks are called in same order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [blueprints, setBlueprints] = React.useState<any[]>([]);
  const [listError, setListError] = React.useState<Error | null>(null);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [showActions, setShowActions] = React.useState(false);
  const [showPopup, setShowPopup] = React.useState(false);

  // Sample terminal width ONCE for fixed layout - no reactive dependencies to avoid re-renders
  // CRITICAL: Initialize with fallback value to prevent any possibility of null/undefined
  const terminalWidth = React.useRef<number>(120);
  if (terminalWidth.current === 120) {
    // Only sample on first render if stdout has valid width
    const sampledWidth =
      stdout?.columns && stdout.columns > 0 ? stdout.columns : 120;
    terminalWidth.current = Math.max(80, Math.min(200, sampledWidth));
  }
  const fixedWidth = terminalWidth.current;

  // All width constants - guaranteed to be valid positive integers
  const statusIconWidth = 2;
  const statusTextWidth = 10;
  const idWidth = 25;
  const nameWidth = Math.max(15, fixedWidth >= 120 ? 30 : 25);
  const descriptionWidth = 40;
  const timeWidth = 20;
  const showDescription = fixedWidth >= 120;

  // Memoize columns array to prevent recreating on every render (memory leak fix)
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

    // Only show create devbox option if blueprint is successfully built
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

    // Always show delete option
    operations.push({
      key: "delete",
      label: "Delete Blueprint",
      color: colors.error,
      icon: figures.cross,
    });

    return operations;
  };

  // Fetch blueprints - moved to top to ensure hooks are called in same order
  React.useEffect(() => {
    let effectMounted = true;

    const fetchBlueprints = async () => {
      if (!isMounted.current) return;

      try {
        if (isMounted.current) {
          setLoading(true);
        }
        const client = getClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pageBlueprints: any[] = [];

        // CRITICAL: Fetch ONLY ONE page with limit, never auto-paginate
        // DO NOT iterate or use for-await - that fetches ALL pages
        const pagePromise = client.blueprints.list({ limit: MAX_FETCH });

        // Await to get the Page object (NOT async iteration)
        let page = (await pagePromise) as BlueprintsCursorIDPage<{
          id: string;
        }>;

        if (!effectMounted || !isMounted.current) return;

        // Extract data immediately and create defensive copies
        if (page.blueprints && Array.isArray(page.blueprints)) {
          // Copy ONLY the fields we need - don't hold entire SDK objects
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
        } else {
          console.error(
            "Unable to access blueprints from page. Available keys:",
            Object.keys(page || {}),
          );
        }

        // CRITICAL: Explicitly null out page reference to help GC
        // The Page object holds references to client, response, and options
        page = null as any;

        if (effectMounted && isMounted.current) {
          setBlueprints(pageBlueprints);
        }
      } catch (err) {
        if (effectMounted && isMounted.current) {
          setListError(err as Error);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    fetchBlueprints();

    return () => {
      effectMounted = false;
    };
  }, []);

  // Handle input for all views - combined into single hook
  useInput((input, key) => {
    // Don't process input if unmounting
    if (!isMounted.current) return;

    // Handle Ctrl+C to force exit
    if (key.ctrl && input === "c") {
      exitAlternateScreenBuffer(); // Exit alternate screen
      process.exit(130);
    }

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
      return; // Let DevboxCreatePage handle its own input
    }

    // Handle actions popup overlay: consume keys and prevent table nav
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
          // Go directly to create devbox screen
          setSelectedBlueprint(selectedBlueprintItem);
          setShowCreateDevbox(true);
        } else {
          // Execute other operations normally
          setSelectedBlueprint(selectedBlueprintItem);
          setExecutingOperation(operationKey as OperationType);
          executeOperation();
        }
      } else if (key.escape || input === "q") {
        setShowPopup(false);
        setSelectedOperation(0);
      } else if (input === "c") {
        // Create devbox hotkey - only if blueprint is complete
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
        // Delete hotkey
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
      return; // prevent falling through to list nav
    }

    // Handle actions view
    if (showActions) {
      if (input === "q" || key.escape) {
        setShowActions(false);
        setSelectedOperation(0);
      }
      return;
    }

    // Handle list navigation (default view)
    const pageSize = PAGE_SIZE;
    const totalPages = Math.ceil(blueprints.length / pageSize);
    const startIndex = currentPage * pageSize;
    const endIndex = Math.min(startIndex + pageSize, blueprints.length);
    const currentBlueprints = blueprints.slice(startIndex, endIndex);
    const pageBlueprints = currentBlueprints.length;

    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < pageBlueprints - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (
      (input === "n" || key.rightArrow) &&
      currentPage < totalPages - 1
    ) {
      setCurrentPage(currentPage + 1);
      setSelectedIndex(0);
    } else if ((input === "p" || key.leftArrow) && currentPage > 0) {
      setCurrentPage(currentPage - 1);
      setSelectedIndex(0);
    } else if (input === "a") {
      setShowPopup(true);
      setSelectedOperation(0);
    } else if (input === "o" && currentBlueprints[selectedIndex]) {
      // Open in browser
      const url = getBlueprintUrl(currentBlueprints[selectedIndex].id);
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
      }
    }
  });

  // Pagination computed early to allow hooks before any returns
  const pageSize = PAGE_SIZE;
  const totalPages = Math.ceil(blueprints.length / pageSize);
  const startIndex = currentPage * pageSize;
  const endIndex = Math.min(startIndex + pageSize, blueprints.length);
  const currentBlueprints = blueprints.slice(startIndex, endIndex);

  // Ensure selected index is within bounds - place before any returns
  React.useEffect(() => {
    if (
      currentBlueprints.length > 0 &&
      selectedIndex >= currentBlueprints.length
    ) {
      setSelectedIndex(Math.max(0, currentBlueprints.length - 1));
    }
  }, [currentBlueprints.length, selectedIndex]);

  const selectedBlueprintItem = currentBlueprints[selectedIndex];

  // Generate operations based on selected blueprint status
  const allOperations = getOperationsForBlueprint(selectedBlueprintItem);

  const executeOperation = async () => {
    const client = getClient();
    const blueprint = selectedBlueprint;

    if (!blueprint) return;

    try {
      setLoading(true);
      switch (executingOperation) {
        case "create_devbox":
          // Navigate to create devbox screen with blueprint pre-filled
          setShowCreateDevbox(true);
          setExecutingOperation(null);
          setLoading(false);
          return;

        case "delete":
          await client.blueprints.delete(blueprint.id);
          setOperationResult(`Blueprint ${blueprint.id} deleted successfully`);
          break;
      }
    } catch (err) {
      setOperationError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  // Filter operations based on blueprint status
  const operations = selectedBlueprint
    ? allOperations.filter((op) => {
        const status = selectedBlueprint.status;

        // Only allow creating devbox if build is complete
        if (op.key === "create_devbox") {
          return status === "build_complete";
        }

        // Allow delete for any status
        return true;
      })
    : allOperations;

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

    if (loading) {
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
        onCreate={(devbox) => {
          // Return to blueprint list after creation
          setShowCreateDevbox(false);
          setSelectedBlueprint(null);
        }}
        initialBlueprintId={selectedBlueprint.id}
      />
    );
  }

  // Loading state
  if (loading) {
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
          <Text> No blueprints found. Try:</Text>
          <Text color={colors.primary} bold>
            rli blueprint create
          </Text>
        </Box>
      </>
    );
  }

  // Pagination moved earlier

  // Overlay: draw quick actions popup over the table (keep table visible)

  // List view
  return (
    <>
      <Breadcrumb items={[{ label: "Blueprints", active: true }]} />

      {/* Table */}
      {!showPopup && (
        <Table
          data={currentBlueprints}
          keyExtractor={(blueprint: any) => blueprint.id}
          selectedIndex={selectedIndex}
          title={`blueprints[${blueprints.length}]`}
          columns={blueprintColumns}
        />
      )}

      {/* Statistics Bar */}
      {!showPopup && (
        <Box marginTop={1} paddingX={1}>
          <Text color={colors.primary} bold>
            {figures.hamburger} {blueprints.length}
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
              <Text color={colors.textDim} dimColor>
                Page {currentPage + 1} of {totalPages}
              </Text>
            </>
          )}
          <Text color={colors.textDim} dimColor>
            {" "}
            •{" "}
          </Text>
          <Text color={colors.textDim} dimColor>
            Showing {startIndex + 1}-{endIndex} of {blueprints.length}
          </Text>
        </Box>
      )}

      {/* Actions Popup - replaces table when shown */}
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
        {totalPages > 1 && (
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
  const executor = createExecutor(options);

  await executor.executeList(
    async () => {
      const client = executor.getClient();
      return executor.fetchFromIterator(client.blueprints.list(), {
        limit: PAGE_SIZE,
      });
    },
    () => <ListBlueprintsUI />,
    PAGE_SIZE,
  );
}

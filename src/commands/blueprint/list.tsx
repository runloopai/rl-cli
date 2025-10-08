import React from "react";
import { Box, Text, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { getClient } from "../../utils/client.js";
import { Header } from "../../components/Header.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { SuccessMessage } from "../../components/SuccessMessage.js";
import { StatusBadge } from "../../components/StatusBadge.js";
import { Breadcrumb } from "../../components/Breadcrumb.js";
import { MetadataDisplay } from "../../components/MetadataDisplay.js";
import { createTextColumn } from "../../components/Table.js";
import { OperationsMenu, Operation } from "../../components/OperationsMenu.js";
import {
  ResourceListView,
  formatTimeAgo,
} from "../../components/ResourceListView.js";
import { createExecutor } from "../../utils/CommandExecutor.js";
import { getBlueprintUrl } from "../../utils/url.js";
import { colors } from "../../utils/theme.js";
import { getStatusDisplay } from "../../components/StatusBadge.js";

const PAGE_SIZE = 10;
const MAX_FETCH = 100;

type OperationType = "create_devbox" | "delete" | null;

const ListBlueprintsUI: React.FC<{
  onBack?: () => void;
  onExit?: () => void;
}> = ({ onBack, onExit }) => {
  const { stdout } = useStdout();
  const [showDetails, setShowDetails] = React.useState(false);
  const [selectedBlueprint, setSelectedBlueprint] = React.useState<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any | null
  >(null);
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

  // Calculate responsive column widths
  const terminalWidth = stdout?.columns || 120;
  const showDescription = terminalWidth >= 120;

  const statusIconWidth = 2;
  const statusTextWidth = 10;
  const idWidth = 25;
  const nameWidth = terminalWidth >= 120 ? 30 : 25;
  const descriptionWidth = 40;
  const timeWidth = 20;

  const allOperations: Operation[] = [
    {
      key: "create_devbox",
      label: "Create Devbox from Blueprint",
      color: colors.success,
      icon: figures.play,
      needsInput: true,
      inputPrompt: "Devbox name (optional):",
      inputPlaceholder: "my-devbox",
    },
    {
      key: "delete",
      label: "Delete Blueprint",
      color: colors.error,
      icon: figures.cross,
    },
  ];

  // Clear console when transitioning to detail view
  const prevShowDetailsRef = React.useRef(showDetails);
  React.useEffect(() => {
    if (showDetails && !prevShowDetailsRef.current) {
      console.clear();
    }
    prevShowDetailsRef.current = showDetails;
  }, [showDetails]);

  // Auto-execute operations that don't need input
  React.useEffect(() => {
    if (executingOperation === "delete" && !loading && selectedBlueprint) {
      executeOperation();
    }
  }, [executingOperation, loading, selectedBlueprint]);

  const executeOperation = async () => {
    const client = getClient();
    const blueprint = selectedBlueprint;

    if (!blueprint) return;

    try {
      setLoading(true);
      switch (executingOperation) {
        case "create_devbox":
          const devbox = await client.devboxes.create({
            blueprint_id: blueprint.id,
            name: operationInput || undefined,
          });
          setOperationResult(
            `Devbox created successfully!\n\n` +
              `ID: ${devbox.id}\n` +
              `Name: ${devbox.name || "(none)"}\n` +
              `Status: ${devbox.status}\n\n` +
              `Use 'rln devbox list' to view all devboxes.`,
          );
          break;

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
          console.clear();
          setExecutingOperation(null);
          setOperationInput("");
        }
      }
      return;
    }

    // Handle operation result display
    if (operationResult || operationError) {
      if (input === "q" || key.escape || key.return) {
        console.clear();
        setOperationResult(null);
        setOperationError(null);
        setExecutingOperation(null);
        setOperationInput("");
      }
      return;
    }

    // Handle details view
    if (showDetails) {
      if (input === "q" || key.escape) {
        console.clear();
        setShowDetails(false);
        setSelectedOperation(0);
      } else if (input === "o" && selectedBlueprint) {
        // Open in browser
        const url = getBlueprintUrl(selectedBlueprint.id);
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
      } else if (key.upArrow && selectedOperation > 0) {
        setSelectedOperation(selectedOperation - 1);
      } else if (key.downArrow && selectedOperation < operations.length - 1) {
        setSelectedOperation(selectedOperation + 1);
      } else if (key.return) {
        console.clear();
        const op = operations[selectedOperation].key as OperationType;
        setExecutingOperation(op);
      }
      return;
    }
  });

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

  // Details view with operation selection
  if (showDetails && selectedBlueprint) {
    const ds = selectedBlueprint.dockerfile_setup;

    return (
      <>
        <Breadcrumb
          items={[
            { label: "Blueprints" },
            {
              label: selectedBlueprint.name || selectedBlueprint.id,
              active: true,
            },
          ]}
        />
        <Header title="Blueprint Details" />

        {/* Compact info section */}
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={colors.primary}
          paddingX={1}
          paddingY={0}
        >
          <Box>
            <Text color={colors.primary} bold>
              {selectedBlueprint.name || selectedBlueprint.id}
            </Text>
            <Text> </Text>
            <StatusBadge status={selectedBlueprint.status} />
            <Text color={colors.textDim} dimColor>
              {" "}
              • {selectedBlueprint.id}
            </Text>
          </Box>
          <Box>
            <Text color={colors.textDim} dimColor>
              {selectedBlueprint.create_time_ms
                ? new Date(selectedBlueprint.create_time_ms).toLocaleString()
                : ""}
            </Text>
            <Text color={colors.textDim} dimColor>
              {" "}
              (
              {selectedBlueprint.create_time_ms
                ? formatTimeAgo(selectedBlueprint.create_time_ms)
                : ""}
              )
            </Text>
          </Box>
          {ds?.description && (
            <Box>
              <Text color={colors.textDim} dimColor>
                {ds.description}
              </Text>
            </Box>
          )}
        </Box>

        {/* Dockerfile setup details */}
        {ds && (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={colors.warning}
            paddingX={1}
            paddingY={0}
          >
            <Text color={colors.warning} bold>
              {figures.squareSmallFilled} Dockerfile Setup
            </Text>
            {ds.base_image && <Text dimColor>Base Image: {ds.base_image}</Text>}
            {ds.entrypoint && <Text dimColor>Entrypoint: {ds.entrypoint}</Text>}
            {ds.system_packages && ds.system_packages.length > 0 && (
              <Text dimColor>
                System Packages: {ds.system_packages.join(", ")}
              </Text>
            )}
            {ds.python_packages && ds.python_packages.length > 0 && (
              <Text dimColor>
                Python Packages: {ds.python_packages.join(", ")}
              </Text>
            )}
          </Box>
        )}

        {/* Metadata */}
        {selectedBlueprint.metadata &&
          Object.keys(selectedBlueprint.metadata).length > 0 && (
            <Box
              borderStyle="round"
              borderColor={colors.success}
              paddingX={1}
              paddingY={0}
            >
              <MetadataDisplay
                metadata={selectedBlueprint.metadata}
                showBorder={false}
              />
            </Box>
          )}

        {/* Failure reason */}
        {selectedBlueprint.build_error && (
          <Box
            borderStyle="round"
            borderColor={colors.error}
            paddingX={1}
            paddingY={0}
          >
            <Text color={colors.error} bold>
              {figures.cross}{" "}
            </Text>
            <Text color={colors.error} dimColor>
              {selectedBlueprint.build_error}
            </Text>
          </Box>
        )}

        {/* Operations */}
        <OperationsMenu
          operations={operations}
          selectedIndex={selectedOperation}
          onNavigate={(direction) => {
            if (direction === "up" && selectedOperation > 0) {
              setSelectedOperation(selectedOperation - 1);
            } else if (
              direction === "down" &&
              selectedOperation < operations.length - 1
            ) {
              setSelectedOperation(selectedOperation + 1);
            }
          }}
          onSelect={(op) => {
            console.clear();
            setExecutingOperation(op.key as OperationType);
          }}
          onBack={() => {
            console.clear();
            setShowDetails(false);
            setSelectedOperation(0);
          }}
          additionalActions={[
            { key: "o", label: "Browser", handler: () => {} },
          ]}
        />
      </>
    );
  }

  // List view using ResourceListView
  return (
    <ResourceListView
      config={{
        resourceName: "Blueprint",
        resourceNamePlural: "Blueprints",
        fetchResources: async () => {
          const client = getClient();
          const allBlueprints: any[] = [];
          let count = 0;
          for await (const blueprint of client.blueprints.list()) {
            allBlueprints.push(blueprint);
            count++;
            if (count >= MAX_FETCH) break;
          }
          return allBlueprints;
        },
        columns: [
          {
            key: "statusIcon",
            label: "",
            width: statusIconWidth,
            render: (blueprint: any, index: number, isSelected: boolean) => {
              const statusDisplay = getStatusDisplay(blueprint.status);
              return (
                <Text
                  color={isSelected ? "white" : statusDisplay.color}
                  bold={true}
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
              const width = idWidth + 1;
              const truncated = value.slice(0, width - 1);
              const padded = truncated.padEnd(width, " ");
              return (
                <Text
                  color={isSelected ? "white" : colors.textDim}
                  bold={false}
                  dimColor={!isSelected}
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
              const truncated = statusDisplay.text.slice(0, statusTextWidth);
              const padded = truncated.padEnd(statusTextWidth, " ");
              return (
                <Text
                  color={isSelected ? "white" : statusDisplay.color}
                  bold={true}
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
              dimColor: true,
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
              dimColor: true,
              bold: false,
            },
          ),
        ],
        keyExtractor: (blueprint: any) => blueprint.id,
        getStatus: (blueprint: any) => blueprint.status,
        statusConfig: {
          success: ["build_complete"],
          warning: ["provisioning", "building"],
          error: ["build_failed"],
        },
        emptyState: {
          message: "No blueprints found. Try:",
          command: "rln blueprint create",
        },
        pageSize: PAGE_SIZE,
        maxFetch: MAX_FETCH,
        onBack: onBack,
        onExit: onExit,
        additionalShortcuts: [
          {
            key: "o",
            label: "Browser",
            handler: (blueprint: any) => {
              const url = getBlueprintUrl(blueprint.id);
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
            },
          },
        ],
        breadcrumbItems: [{ label: "Blueprints", active: true }],
      }}
    />
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

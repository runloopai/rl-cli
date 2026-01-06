import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { ActionsPopup } from "./ActionsPopup.js";
import { DevboxActionsMenu } from "./DevboxActionsMenu.js";

type OperationDef = {
  key: string;
  label: string;
  color: string;
  icon: string;
  shortcut?: string;
  needsInput?: boolean;
  inputPrompt?: string;
  inputPlaceholder?: string;
};

interface BaseProps {
  resource: { id: string; name?: string | null };
  onBack: () => void;
  breadcrumbItems?: Array<{ label: string; active?: boolean }>;
  initialOperation?: string;
  initialOperationIndex?: number;
  skipOperationsMenu?: boolean;
}

type DevboxMenuProps = BaseProps & {
  resourceType: "devbox";
};

type BlueprintMenuProps = BaseProps & {
  resourceType: "blueprint";
  operations: OperationDef[];
  onExecute: (
    opKey: string,
    args: { input?: string },
  ) => Promise<string | void>;
};

type ResourceActionsMenuProps = DevboxMenuProps | BlueprintMenuProps;

export const ResourceActionsMenu = (props: ResourceActionsMenuProps) => {
  if (props.resourceType === "devbox") {
    const {
      resource,
      onBack,
      breadcrumbItems,
      initialOperation,
      initialOperationIndex,
      skipOperationsMenu,
    } = props;

    return (
      <DevboxActionsMenu
        devbox={resource}
        onBack={onBack}
        breadcrumbItems={breadcrumbItems}
        initialOperation={initialOperation}
        initialOperationIndex={initialOperationIndex}
        skipOperationsMenu={skipOperationsMenu}
      />
    );
  }

  // Blueprint generic actions menu
  const {
    resource,
    onBack,
    breadcrumbItems = [
      { label: "Blueprints" },
      { label: resource.name || resource.id, active: true },
    ],
    operations,
    initialOperation,
    initialOperationIndex = 0,
    skipOperationsMenu = false,
    onExecute,
  } = props;

  const [selectedOperation, setSelectedOperation] = React.useState(
    initialOperationIndex,
  );
  const [executingOperation, setExecutingOperation] = React.useState<
    string | null
  >(initialOperation || null);
  const [operationInput, setOperationInput] = React.useState("");
  const [operationResult, setOperationResult] = React.useState<string | null>(
    null,
  );
  const [operationError, setOperationError] = React.useState<Error | null>(
    null,
  );

  React.useEffect(() => {
    if (skipOperationsMenu && initialOperation) {
      setExecutingOperation(initialOperation);
    }
  }, [skipOperationsMenu, initialOperation]);

  const selectedOp =
    operations[selectedOperation] ||
    operations.find((o) => o.key === executingOperation);

  const execute = async () => {
    try {
      const result = await onExecute(executingOperation as string, {
        input: operationInput.trim() || undefined,
      });
      if (typeof result === "string") {
        setOperationResult(result);
      } else {
        // No result to show; go back
        onBack();
      }
    } catch (err) {
      setOperationError(err as Error);
    }
  };

  useInput((input, key) => {
    // Result screen
    if (operationResult || operationError) {
      if (key.return || key.escape || input === "q") {
        onBack();
      }
      return;
    }

    // If executing and needs input
    if (executingOperation) {
      const op = operations.find((o) => o.key === executingOperation);
      if (op?.needsInput) {
        if (key.return) {
          execute();
        } else if (input === "q" || key.escape) {
          setExecutingOperation(null);
          setOperationInput("");
        } else if (input.length === 1) {
          setOperationInput((prev) => prev + input);
        } else if (key.backspace) {
          setOperationInput((prev) => prev.slice(0, -1));
        }
        return;
      }

      // No input needed: execute immediately
      execute();
      return;
    }

    // Operations menu navigation
    if (key.upArrow && selectedOperation > 0) {
      setSelectedOperation(selectedOperation - 1);
    } else if (key.downArrow && selectedOperation < operations.length - 1) {
      setSelectedOperation(selectedOperation + 1);
    } else if (key.return) {
      setExecutingOperation(operations[selectedOperation].key);
    } else if (key.escape || input === "q") {
      onBack();
    } else {
      // Shortcut keys
      const idx = operations.findIndex((op) => op.shortcut === input);
      if (idx >= 0) {
        setSelectedOperation(idx);
        setExecutingOperation(operations[idx].key);
      }
    }
  });

  // Screens
  if (operationResult || operationError) {
    const label = operations.find((o) => o.key === executingOperation)?.label;
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <Box marginTop={1} flexDirection="column">
          <Text color={operationError ? colors.error : colors.success}>
            {operationError ? `${label} failed` : `${label} completed`}
          </Text>
          {!!operationResult && (
            <Text color={colors.textDim} dimColor>
              {operationResult}
            </Text>
          )}
          <Text color={colors.textDim} dimColor>
            {figures.pointerSmall} Press [Enter] to go back
          </Text>
        </Box>
      </>
    );
  }

  if (executingOperation && selectedOp?.needsInput) {
    return (
      <>
        <Breadcrumb items={breadcrumbItems} />
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.textDim}>
            {selectedOp.inputPrompt || "Input:"}{" "}
          </Text>
          <Text> {operationInput}</Text>
          <Text color={colors.textDim} dimColor>
            Press [Enter] to execute • [q or esc] Cancel
          </Text>
        </Box>
      </>
    );
  }

  // Operations menu
  return (
    <>
      <Breadcrumb items={breadcrumbItems} />
      <Box marginTop={1} justifyContent="center">
        <ActionsPopup
          devbox={resource}
          operations={operations.map((op) => ({
            key: op.key,
            label: op.label,
            color: op.color,
            icon: op.icon,
            shortcut: op.shortcut || "",
          }))}
          selectedOperation={selectedOperation}
          onClose={onBack}
        />
      </Box>
    </>
  );
};

/**
 * DevboxExecScreen - Dedicated screen for command execution
 * Route-based state ensures stability across terminal resizes
 */
import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { useNavigation, type RouteParams } from "../store/navigationStore.js";
import { useDevboxStore } from "../store/devboxStore.js";
import { ExecViewer } from "../components/ExecViewer.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { colors } from "../utils/theme.js";

interface DevboxExecScreenProps {
  devboxId?: string;
  execCommand?: string;
  executionId?: string;
  devboxName?: string;
  returnScreen?: string;
  returnParams?: RouteParams;
}

export function DevboxExecScreen({
  devboxId,
  execCommand,
  executionId,
  devboxName,
  returnScreen,
  returnParams,
}: DevboxExecScreenProps) {
  const { goBack, replace, params } = useNavigation();
  const devboxes = useDevboxStore((state) => state.devboxes);

  // Find devbox in store for display name
  const devbox = devboxes.find((d) => d.id === devboxId);
  const displayName = devboxName || devbox?.name || devboxId || "devbox";

  // Validate required params
  if (!devboxId || !execCommand) {
    return (
      <>
        <Breadcrumb items={[{ label: "Exec", active: true }]} />
        <Box flexDirection="column" paddingX={1}>
          <Text color={colors.error}>
            {figures.cross} Missing execution parameters. Returning...
          </Text>
        </Box>
      </>
    );
  }

  // Build breadcrumbs
  const breadcrumbItems = [
    { label: "Devboxes" },
    { label: displayName },
    { label: "Execute", active: true },
  ];

  // Handle execution ID update - store in route params for persistence
  const handleExecutionStart = React.useCallback(
    (newExecutionId: string) => {
      // Update route params to persist execution ID across re-renders
      replace("devbox-exec", {
        ...params,
        executionId: newExecutionId,
      });
    },
    [replace, params],
  );

  // Handle back navigation
  const handleBack = React.useCallback(() => {
    goBack();
  }, [goBack]);

  // Handle run another command - navigate to actions menu with exec pre-selected
  const handleRunAnother = React.useCallback(() => {
    // Replace current screen with actions menu, exec operation pre-selected
    replace("devbox-actions", {
      devboxId: devboxId,
      operation: "exec",
    });
  }, [replace, devboxId]);

  return (
    <ExecViewer
      devboxId={devboxId}
      command={execCommand}
      breadcrumbItems={breadcrumbItems}
      onBack={handleBack}
      onRunAnother={handleRunAnother}
      existingExecutionId={executionId}
      onExecutionStart={handleExecutionStart}
    />
  );
}

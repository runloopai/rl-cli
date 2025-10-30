/**
 * DevboxActionsScreen - Pure UI component for devbox actions
 * Refactored from components/DevboxActionsMenu.tsx
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { useDevboxStore } from "../store/devboxStore.js";
import { DevboxActionsMenu } from "../components/DevboxActionsMenu.js";
import type { SSHSessionConfig } from "../utils/sshSession.js";

interface DevboxActionsScreenProps {
  devboxId?: string;
  operation?: string;
  onSSHRequest?: (config: SSHSessionConfig) => void;
}

export function DevboxActionsScreen({
  devboxId,
  operation,
  onSSHRequest,
}: DevboxActionsScreenProps) {
  const { goBack } = useNavigation();
  const devboxes = useDevboxStore((state) => state.devboxes);

  // Find devbox in store
  const devbox = devboxes.find((d) => d.id === devboxId);

  // Navigate back if devbox not found - must be in useEffect, not during render
  React.useEffect(() => {
    if (!devbox) {
      goBack();
    }
  }, [devbox, goBack]);

  if (!devbox) {
    return null;
  }

  return (
    <DevboxActionsMenu
      devbox={devbox}
      onBack={goBack}
      initialOperation={operation}
      onSSHRequest={onSSHRequest}
    />
  );
}

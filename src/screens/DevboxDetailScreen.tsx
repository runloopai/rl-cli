/**
 * DevboxDetailScreen - Pure UI component for devbox details
 * Refactored from components/DevboxDetailPage.tsx
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { useDevboxStore } from "../store/devboxStore.js";
import { DevboxDetailPage } from "../components/DevboxDetailPage.js";
import type { SSHSessionConfig } from "../utils/sshSession.js";

interface DevboxDetailScreenProps {
  devboxId?: string;
  onSSHRequest?: (config: SSHSessionConfig) => void;
}

export function DevboxDetailScreen({
  devboxId,
  onSSHRequest,
}: DevboxDetailScreenProps) {
  const { goBack } = useNavigation();
  const devboxes = useDevboxStore((state) => state.devboxes);

  // Find devbox in store first, otherwise we'd need to fetch it
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
    <DevboxDetailPage
      devbox={devbox}
      onBack={goBack}
      onSSHRequest={onSSHRequest}
    />
  );
}

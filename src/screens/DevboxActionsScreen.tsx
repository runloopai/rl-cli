/**
 * DevboxActionsScreen - Pure UI component for devbox actions
 * Refactored from components/DevboxActionsMenu.tsx
 */
import React from "react";
import { useNavigationStore } from "../store/navigationStore.js";
import { useDevboxStore } from "../store/devboxStore.js";
import { DevboxActionsMenu } from "../components/DevboxActionsMenu.js";
import type { SSHSessionConfig } from "../utils/sshSession.js";

interface DevboxActionsScreenProps {
  devboxId?: string;
  operation?: string;
  onSSHRequest?: (config: SSHSessionConfig) => void;
}

export const DevboxActionsScreen: React.FC<DevboxActionsScreenProps> =
  React.memo(({ devboxId, operation, onSSHRequest }) => {
    const goBack = useNavigationStore((state) => state.goBack);
    const devboxes = useDevboxStore((state) => state.devboxes);

    // Find devbox in store
    const devbox = React.useMemo(() => {
      return devboxes.find((d) => d.id === devboxId);
    }, [devboxes, devboxId]);

    if (!devbox) {
      goBack();
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
  });

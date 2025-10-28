/**
 * DevboxDetailScreen - Pure UI component for devbox details
 * Refactored from components/DevboxDetailPage.tsx
 */
import React from "react";
import { useNavigationStore } from "../store/navigationStore.js";
import { useDevboxStore } from "../store/devboxStore.js";
import { DevboxDetailPage } from "../components/DevboxDetailPage.js";
import type { SSHSessionConfig } from "../utils/sshSession.js";

interface DevboxDetailScreenProps {
  devboxId?: string;
  onSSHRequest?: (config: SSHSessionConfig) => void;
}

export const DevboxDetailScreen: React.FC<DevboxDetailScreenProps> = React.memo(
  ({ devboxId, onSSHRequest }) => {
    const goBack = useNavigationStore((state) => state.goBack);
    const devboxes = useDevboxStore((state) => state.devboxes);

    // Find devbox in store first, otherwise we'd need to fetch it
    const devbox = React.useMemo(() => {
      return devboxes.find((d) => d.id === devboxId);
    }, [devboxes, devboxId]);

    if (!devbox) {
      goBack();
      return null;
    }

    return (
      <DevboxDetailPage
        devbox={devbox}
        onBack={goBack}
        onSSHRequest={onSSHRequest}
      />
    );
  },
);

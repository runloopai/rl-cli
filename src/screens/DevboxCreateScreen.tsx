/**
 * DevboxCreateScreen - Pure UI component for creating devboxes
 * Refactored from components/DevboxCreatePage.tsx
 */
import React from "react";
import type { DevboxView } from "@runloop/api-client/resources/devboxes/devboxes";
import { useNavigation } from "../store/navigationStore.js";
import { DevboxCreatePage } from "../components/DevboxCreatePage.js";

export function DevboxCreateScreen() {
  const { goBack, navigate, params } = useNavigation();

  const handleCreate = (devbox: DevboxView) => {
    // After creation, navigate to the devbox detail page
    navigate("devbox-detail", { devboxId: devbox.id });
  };

  return (
    <DevboxCreatePage
      onBack={goBack}
      onCreate={handleCreate}
      initialBlueprintId={params.blueprintId}
      initialSnapshotId={params.snapshotId}
    />
  );
}

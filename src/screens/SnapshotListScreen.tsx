/**
 * SnapshotListScreen - Pure UI component using snapshotStore
 * Simplified version for now - wraps existing component
 */
import React from "react";
import { useNavigationStore } from "../store/navigationStore.js";
import { ListSnapshotsUI } from "../commands/snapshot/list.js";

export const SnapshotListScreen: React.FC = React.memo(() => {
  const goBack = useNavigationStore((state) => state.goBack);

  return <ListSnapshotsUI onBack={goBack} onExit={goBack} />;
});

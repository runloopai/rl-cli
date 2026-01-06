/**
 * SnapshotListScreen - Pure UI component using snapshotStore
 * Simplified version for now - wraps existing component
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { ListSnapshotsUI } from "../commands/snapshot/list.js";

export function SnapshotListScreen() {
  const { goBack } = useNavigation();

  return <ListSnapshotsUI onBack={goBack} onExit={goBack} />;
}

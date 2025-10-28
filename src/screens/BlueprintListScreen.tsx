/**
 * BlueprintListScreen - Pure UI component using blueprintStore
 * Simplified version for now - wraps existing component
 */
import React from "react";
import { useNavigationStore } from "../store/navigationStore.js";
import { ListBlueprintsUI } from "../commands/blueprint/list.js";

export const BlueprintListScreen: React.FC = React.memo(() => {
  const goBack = useNavigationStore((state) => state.goBack);

  return <ListBlueprintsUI onBack={goBack} onExit={goBack} />;
});

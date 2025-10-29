/**
 * BlueprintListScreen - Pure UI component using blueprintStore
 * Simplified version for now - wraps existing component
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { ListBlueprintsUI } from "../commands/blueprint/list.js";

export function BlueprintListScreen() {
  const { goBack } = useNavigation();

  return <ListBlueprintsUI onBack={goBack} onExit={goBack} />;
}

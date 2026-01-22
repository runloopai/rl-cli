/**
 * ObjectListScreen - Pure UI component using objectStore
 * Simplified version for now - wraps existing component
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { ListObjectsUI } from "../commands/object/list.js";

export function ObjectListScreen() {
  const { goBack } = useNavigation();

  return <ListObjectsUI onBack={goBack} onExit={goBack} />;
}

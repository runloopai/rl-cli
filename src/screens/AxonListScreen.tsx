/**
 * AxonListScreen - Wraps ListAxonsUI for TUI navigation
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { ListAxonsUI } from "../commands/axon/list.js";

export function AxonListScreen() {
  const { goBack } = useNavigation();

  return <ListAxonsUI onBack={goBack} onExit={goBack} />;
}

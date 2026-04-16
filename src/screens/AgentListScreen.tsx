/**
 * AgentListScreen - Wraps ListAgentsUI for TUI navigation
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { ListAgentsUI } from "../commands/agent/list.js";

export function AgentListScreen() {
  const { goBack } = useNavigation();

  return <ListAgentsUI onBack={goBack} onExit={goBack} />;
}

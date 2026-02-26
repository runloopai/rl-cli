/**
 * McpConfigListScreen - Screen wrapper for MCP config list
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { ListMcpConfigsUI } from "../commands/mcp-config/list.js";

export function McpConfigListScreen() {
  const { goBack } = useNavigation();

  return <ListMcpConfigsUI onBack={goBack} />;
}

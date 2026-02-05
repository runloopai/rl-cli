/**
 * GatewayConfigListScreen - Screen wrapper for gateway config list
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { ListGatewayConfigsUI } from "../commands/gateway-config/list.js";

export function GatewayConfigListScreen() {
  const { goBack } = useNavigation();

  return <ListGatewayConfigsUI onBack={goBack} />;
}

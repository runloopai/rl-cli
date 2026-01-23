/**
 * NetworkPolicyListScreen - Screen wrapper for network policy list
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { ListNetworkPoliciesUI } from "../commands/network-policy/list.js";

export function NetworkPolicyListScreen() {
  const { goBack } = useNavigation();

  return <ListNetworkPoliciesUI onBack={goBack} />;
}

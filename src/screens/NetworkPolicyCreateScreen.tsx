/**
 * NetworkPolicyCreateScreen - Screen wrapper for network policy creation
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { NetworkPolicyCreatePage } from "../components/NetworkPolicyCreatePage.js";

export function NetworkPolicyCreateScreen() {
  const { goBack, navigate } = useNavigation();

  return (
    <NetworkPolicyCreatePage
      onBack={goBack}
      onCreate={(policy) =>
        navigate("network-policy-detail", { networkPolicyId: policy.id })
      }
    />
  );
}

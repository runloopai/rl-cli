/**
 * SecretCreateScreen - Screen wrapper for secret creation
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { SecretCreatePage } from "../components/SecretCreatePage.js";

export function SecretCreateScreen() {
  const { goBack, navigate } = useNavigation();

  return (
    <SecretCreatePage
      onBack={goBack}
      onCreate={(secret) => navigate("secret-detail", { secretId: secret.id })}
    />
  );
}

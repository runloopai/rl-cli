/**
 * SecretListScreen - Screen wrapper for secret list
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { ListSecretsUI } from "../commands/secret/list.js";

export function SecretListScreen() {
  const { goBack } = useNavigation();

  return <ListSecretsUI onBack={goBack} />;
}

import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { BlueprintCreatePage } from "../components/BlueprintCreatePage.js";

interface BlueprintCreateScreenProps {
  baseBlueprintId?: string;
}

export function BlueprintCreateScreen({
  baseBlueprintId,
}: BlueprintCreateScreenProps) {
  const { goBack, navigate } = useNavigation();

  return (
    <BlueprintCreatePage
      onBack={goBack}
      onCreate={(blueprintId) => navigate("blueprint-detail", { blueprintId })}
      baseBlueprintId={baseBlueprintId}
    />
  );
}

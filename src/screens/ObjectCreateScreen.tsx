import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { ObjectCreatePage } from "../components/ObjectCreatePage.js";

export function ObjectCreateScreen() {
  const { goBack, navigate } = useNavigation();
  return (
    <ObjectCreatePage
      onBack={goBack}
      onCreate={(objectId) => navigate("object-detail", { objectId })}
    />
  );
}

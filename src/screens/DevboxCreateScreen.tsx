/**
 * DevboxCreateScreen - Pure UI component for creating devboxes
 * Refactored from components/DevboxCreatePage.tsx
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { DevboxCreatePage } from "../components/DevboxCreatePage.js";

export function DevboxCreateScreen() {
  const { goBack } = useNavigation();

  const handleCreate = () => {
    // After creation, go back to list (which will refresh)
    goBack();
  };

  return <DevboxCreatePage onBack={goBack} onCreate={handleCreate} />;
}

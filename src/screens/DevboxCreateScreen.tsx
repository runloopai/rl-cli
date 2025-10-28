/**
 * DevboxCreateScreen - Pure UI component for creating devboxes
 * Refactored from components/DevboxCreatePage.tsx
 */
import React from "react";
import { useNavigationStore } from "../store/navigationStore.js";
import { DevboxCreatePage } from "../components/DevboxCreatePage.js";

export const DevboxCreateScreen: React.FC = React.memo(() => {
  const goBack = useNavigationStore((state) => state.goBack);

  const handleCreate = React.useCallback(() => {
    // After creation, go back to list (which will refresh)
    goBack();
  }, [goBack]);

  return <DevboxCreatePage onBack={goBack} onCreate={handleCreate} />;
});

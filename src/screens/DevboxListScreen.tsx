/**
 * DevboxListScreen - Pure UI component using devboxStore
 * Simplified version for now - wraps existing component
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { ListDevboxesUI } from "../commands/devbox/list.js";

interface DevboxListScreenProps {
  status?: string;
  focusDevboxId?: string;
}

export function DevboxListScreen({
  status,
  focusDevboxId,
}: DevboxListScreenProps) {
  const { goBack, navigate } = useNavigation();

  // If focusDevboxId is provided, navigate directly to detail screen
  // instead of letting ListDevboxesUI handle it internally
  React.useEffect(() => {
    if (focusDevboxId) {
      navigate("devbox-detail", { devboxId: focusDevboxId });
    }
  }, [focusDevboxId, navigate]);

  // Navigation callback to handle detail view via Router
  const handleNavigateToDetail = React.useCallback(
    (devboxId: string) => {
      navigate("devbox-detail", { devboxId });
    },
    [navigate],
  );

  return (
    <ListDevboxesUI
      status={status}
      onBack={goBack}
      onExit={goBack}
      onNavigateToDetail={handleNavigateToDetail}
    />
  );
}

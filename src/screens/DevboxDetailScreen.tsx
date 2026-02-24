/**
 * DevboxDetailScreen - Pure UI component for devbox details
 * Refactored from components/DevboxDetailPage.tsx
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { useDevboxStore, type Devbox } from "../store/devboxStore.js";
import { DevboxDetailPage } from "../components/DevboxDetailPage.js";
import { getDevbox } from "../services/devboxService.js";
import { useResourceDetail } from "../hooks/useResourceDetail.js";
import { SpinnerComponent } from "../components/Spinner.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { Breadcrumb } from "../components/Breadcrumb.js";

interface DevboxDetailScreenProps {
  devboxId?: string;
}

export function DevboxDetailScreen({ devboxId }: DevboxDetailScreenProps) {
  const { goBack } = useNavigation();
  const devboxes = useDevboxStore((state) => state.devboxes);
  const setDevboxesInStore = useDevboxStore((state) => state.setDevboxes);
  const devboxFromStore = devboxes.find((d) => d.id === devboxId);

  const {
    data: devbox,
    loading,
    error,
  } = useResourceDetail<Devbox>({
    id: devboxId,
    fetch: getDevbox,
    initialData: devboxFromStore ?? undefined,
    pollInterval: 3000,
    shouldPoll: (d) =>
      d.status === "running" ||
      d.status === "provisioning" ||
      d.status === "initializing" ||
      d.status === "resuming" ||
      d.status === "suspending",
  });

  // Cache fetched devbox in store for list/other screens
  React.useEffect(() => {
    if (devbox) {
      setDevboxesInStore([devbox]);
    }
  }, [devbox, setDevboxesInStore]);

  // Show loading state while fetching or before fetch starts
  if (!devbox && devboxId && !error) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Devboxes" }, { label: "Loading...", active: true }]}
        />
        <SpinnerComponent message="Loading devbox details..." />
      </>
    );
  }

  // Show error state if fetch failed
  if (error && !devbox) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Devboxes" }, { label: "Error", active: true }]}
        />
        <ErrorMessage message="Failed to load devbox details" error={error} />
      </>
    );
  }

  // Show error if no devbox found
  if (!devbox) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Devboxes" }, { label: "Not Found", active: true }]}
        />
        <ErrorMessage
          message={`Devbox ${devboxId || "unknown"} not found`}
          error={
            new Error("Devbox not found in cache and could not be fetched")
          }
        />
      </>
    );
  }

  // At this point devbox is guaranteed to exist (loading check above handles the null case)
  if (!devbox) {
    return null; // TypeScript guard - should never reach here
  }

  return <DevboxDetailPage devbox={devbox} onBack={goBack} />;
}

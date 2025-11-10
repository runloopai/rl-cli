/**
 * DevboxDetailScreen - Pure UI component for devbox details
 * Refactored from components/DevboxDetailPage.tsx
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { useDevboxStore } from "../store/devboxStore.js";
import { DevboxDetailPage } from "../components/DevboxDetailPage.js";
import { getDevbox } from "../services/devboxService.js";
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

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [fetchedDevbox, setFetchedDevbox] = React.useState<any>(null);

  // Find devbox in store first
  const devboxFromStore = devboxes.find((d) => d.id === devboxId);

  // Fetch devbox from API if not in store
  React.useEffect(() => {
    if (!devboxFromStore && devboxId && !loading && !fetchedDevbox) {
      setLoading(true);
      setError(null);

      getDevbox(devboxId)
        .then((devbox) => {
          setFetchedDevbox(devbox);
          // Cache it in store for future access
          setDevboxesInStore([devbox]);
          setLoading(false);
        })
        .catch((err) => {
          setError(err as Error);
          setLoading(false);
        });
    }
  }, [devboxFromStore, devboxId, loading, fetchedDevbox, setDevboxesInStore]);

  // Use devbox from store or fetched devbox
  const devbox = devboxFromStore || fetchedDevbox;

  // Show loading state while fetching
  if (loading) {
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
  if (error) {
    return (
      <>
        <Breadcrumb
          items={[{ label: "Devboxes" }, { label: "Error", active: true }]}
        />
        <ErrorMessage message="Failed to load devbox details" error={error} />
      </>
    );
  }

  // Show error if no devbox found and not loading
  if (!devbox && !loading) {
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

  return <DevboxDetailPage devbox={devbox} onBack={goBack} />;
}

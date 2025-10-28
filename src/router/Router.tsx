/**
 * Router - Manages screen navigation with clean mount/unmount lifecycle
 * Replaces conditional rendering pattern from menu.tsx
 */
import React from "react";
import { useNavigationStore } from "../store/navigationStore.js";
import { useDevboxStore } from "../store/devboxStore.js";
import { useBlueprintStore } from "../store/blueprintStore.js";
import { useSnapshotStore } from "../store/snapshotStore.js";
import { logMemoryUsage, checkMemoryPressure } from "../utils/memoryMonitor.js";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
import type { ScreenName } from "../router/types.js";

interface RouterProps {
  screens: Record<ScreenName, React.ComponentType<any>>;
}

/**
 * Router component that renders the current screen
 * Implements memory cleanup on route changes
 *
 * Uses React key prop to force complete unmount/remount on screen changes,
 * which prevents Yoga WASM errors during transitions.
 */
export const Router: React.FC<RouterProps> = ({ screens }) => {
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const params = useNavigationStore((state) => state.params);
  const prevScreenRef = React.useRef<ScreenName | null>(null);

  // Memory cleanup on route changes
  React.useEffect(() => {
    const prevScreen = prevScreenRef.current;

    if (prevScreen && prevScreen !== currentScreen) {
      logMemoryUsage(`Route change: ${prevScreen} → ${currentScreen}`);

      // Immediate cleanup without delay - React's key-based remount handles timing
      switch (prevScreen) {
        case "devbox-list":
        case "devbox-detail":
        case "devbox-actions":
        case "devbox-create":
          // Clear devbox data when leaving devbox screens
          // Keep cache if we're still in devbox context
          if (!currentScreen.startsWith("devbox")) {
            useDevboxStore.getState().clearAll();
            logMemoryUsage("Cleared devbox store");
          }
          break;

        case "blueprint-list":
        case "blueprint-detail":
          if (!currentScreen.startsWith("blueprint")) {
            useBlueprintStore.getState().clearAll();
            logMemoryUsage("Cleared blueprint store");
          }
          break;

        case "snapshot-list":
        case "snapshot-detail":
          if (!currentScreen.startsWith("snapshot")) {
            useSnapshotStore.getState().clearAll();
            logMemoryUsage("Cleared snapshot store");
          }
          break;
      }

      // Check memory pressure and trigger GC if needed
      // Small delay to allow cleanup to complete
      setTimeout(() => {
        checkMemoryPressure();
        logMemoryUsage(`After cleanup: ${currentScreen}`);
      }, 50);
    }

    prevScreenRef.current = currentScreen;
  }, [currentScreen]);

  const ScreenComponent = screens[currentScreen];

  if (!ScreenComponent) {
    console.error(`No screen registered for: ${currentScreen}`);
    return null;
  }

  // CRITICAL: Use key prop to force React to completely unmount old component
  // and mount new component, preventing race conditions during screen transitions.
  // The key ensures React treats this as a completely new component tree.
  // Wrap in ErrorBoundary to catch any Yoga WASM errors gracefully.
  return (
    <ErrorBoundary key={`boundary-${currentScreen}`}>
      <ScreenComponent key={currentScreen} {...params} />
    </ErrorBoundary>
  );
};

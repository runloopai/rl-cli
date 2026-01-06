/**
 * Router - Manages screen navigation with clean mount/unmount lifecycle
 * Replaces conditional rendering pattern from menu.tsx
 */
import React from "react";
import { useNavigation } from "../store/navigationStore.js";
import { useDevboxStore } from "../store/devboxStore.js";
import { useBlueprintStore } from "../store/blueprintStore.js";
import { useSnapshotStore } from "../store/snapshotStore.js";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
import type { ScreenName } from "../router/types.js";

// Import screen components
import { MenuScreen } from "../screens/MenuScreen.js";
import { DevboxListScreen } from "../screens/DevboxListScreen.js";
import { DevboxDetailScreen } from "../screens/DevboxDetailScreen.js";
import { DevboxActionsScreen } from "../screens/DevboxActionsScreen.js";
import { DevboxCreateScreen } from "../screens/DevboxCreateScreen.js";
import { BlueprintListScreen } from "../screens/BlueprintListScreen.js";
import { SnapshotListScreen } from "../screens/SnapshotListScreen.js";
import { SSHSessionScreen } from "../screens/SSHSessionScreen.js";

/**
 * Router component that renders the current screen
 * Implements memory cleanup on route changes
 *
 * Uses React key prop to force complete unmount/remount on screen changes,
 * which prevents Yoga WASM errors during transitions.
 */
export function Router() {
  const { currentScreen, params } = useNavigation();
  const prevScreenRef = React.useRef<ScreenName | null>(null);

  // Memory cleanup on route changes
  React.useEffect(() => {
    const prevScreen = prevScreenRef.current;

    if (prevScreen && prevScreen !== currentScreen) {
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
          }
          break;

        case "blueprint-list":
        case "blueprint-detail":
          if (!currentScreen.startsWith("blueprint")) {
            useBlueprintStore.getState().clearAll();
          }
          break;

        case "snapshot-list":
        case "snapshot-detail":
          if (!currentScreen.startsWith("snapshot")) {
            useSnapshotStore.getState().clearAll();
          }
          break;
      }
    }

    prevScreenRef.current = currentScreen;
  }, [currentScreen]);

  // CRITICAL: Use key prop to force React to completely unmount old component
  // and mount new component, preventing race conditions during screen transitions.
  // The key ensures React treats this as a completely new component tree.
  // Wrap in ErrorBoundary to catch any Yoga WASM errors gracefully.
  return (
    <ErrorBoundary key={`boundary-${currentScreen}`}>
      {currentScreen === "menu" && (
        <MenuScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "devbox-list" && (
        <DevboxListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "devbox-detail" && (
        <DevboxDetailScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "devbox-actions" && (
        <DevboxActionsScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "devbox-create" && (
        <DevboxCreateScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "blueprint-list" && (
        <BlueprintListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "blueprint-detail" && (
        <BlueprintListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "snapshot-list" && (
        <SnapshotListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "snapshot-detail" && (
        <SnapshotListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "ssh-session" && (
        <SSHSessionScreen key={currentScreen} {...params} />
      )}
    </ErrorBoundary>
  );
}

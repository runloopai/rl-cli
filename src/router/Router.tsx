/**
 * Router - Manages screen navigation with clean mount/unmount lifecycle
 * Replaces conditional rendering pattern from menu.tsx
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { useNavigation } from "../store/navigationStore.js";
import { useDevboxStore } from "../store/devboxStore.js";
import { useBlueprintStore } from "../store/blueprintStore.js";
import { useSnapshotStore } from "../store/snapshotStore.js";
import { useNetworkPolicyStore } from "../store/networkPolicyStore.js";
import { useObjectStore } from "../store/objectStore.js";
import { useBenchmarkStore } from "../store/benchmarkStore.js";
import { useBenchmarkJobStore } from "../store/benchmarkJobStore.js";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
import { colors } from "../utils/theme.js";
import type { ScreenName } from "../router/types.js";

// List of all known screens
const KNOWN_SCREENS: Set<ScreenName> = new Set([
  "menu",
  "settings-menu",
  "devbox-list",
  "devbox-detail",
  "devbox-actions",
  "devbox-exec",
  "devbox-create",
  "blueprint-list",
  "blueprint-detail",
  "blueprint-logs",
  "snapshot-list",
  "snapshot-detail",
  "network-policy-list",
  "network-policy-detail",
  "network-policy-create",
  "secret-list",
  "secret-detail",
  "secret-create",
  "object-list",
  "object-detail",
  "ssh-session",
  "benchmark-menu",
  "benchmark-list",
  "benchmark-detail",
  "benchmark-run-list",
  "benchmark-run-detail",
  "scenario-run-list",
  "scenario-run-detail",
  "benchmark-job-list",
  "benchmark-job-detail",
  "benchmark-job-create",
]);

/**
 * Fallback screen for unknown routes
 */
function UnknownScreen({ screenName }: { screenName: string }) {
  const { navigate } = useNavigation();

  useInput((input, key) => {
    if (key.return) {
      navigate("menu");
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color={colors.warning} bold>
          {figures.warning} Unknown Page
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text color={colors.textDim}>
          {"You've navigated to an unknown page: "}
          <Text color={colors.error}>{`"${screenName}"`}</Text>
        </Text>
      </Box>
      <Box>
        <Text color={colors.textDim}>
          Press{" "}
          <Text color={colors.primary} bold>
            Enter
          </Text>{" "}
          to return to the main menu
        </Text>
      </Box>
    </Box>
  );
}

// Import screen components
import { MenuScreen } from "../screens/MenuScreen.js";
import { DevboxListScreen } from "../screens/DevboxListScreen.js";
import { DevboxDetailScreen } from "../screens/DevboxDetailScreen.js";
import { DevboxActionsScreen } from "../screens/DevboxActionsScreen.js";
import { DevboxExecScreen } from "../screens/DevboxExecScreen.js";
import { DevboxCreateScreen } from "../screens/DevboxCreateScreen.js";
import { BlueprintListScreen } from "../screens/BlueprintListScreen.js";
import { BlueprintDetailScreen } from "../screens/BlueprintDetailScreen.js";
import { BlueprintLogsScreen } from "../screens/BlueprintLogsScreen.js";
import { SnapshotListScreen } from "../screens/SnapshotListScreen.js";
import { SnapshotDetailScreen } from "../screens/SnapshotDetailScreen.js";
import { NetworkPolicyListScreen } from "../screens/NetworkPolicyListScreen.js";
import { NetworkPolicyDetailScreen } from "../screens/NetworkPolicyDetailScreen.js";
import { NetworkPolicyCreateScreen } from "../screens/NetworkPolicyCreateScreen.js";
import { SettingsMenuScreen } from "../screens/SettingsMenuScreen.js";
import { SecretListScreen } from "../screens/SecretListScreen.js";
import { SecretDetailScreen } from "../screens/SecretDetailScreen.js";
import { SecretCreateScreen } from "../screens/SecretCreateScreen.js";
import { ObjectListScreen } from "../screens/ObjectListScreen.js";
import { ObjectDetailScreen } from "../screens/ObjectDetailScreen.js";
import { SSHSessionScreen } from "../screens/SSHSessionScreen.js";
import { BenchmarkMenuScreen } from "../screens/BenchmarkMenuScreen.js";
import { BenchmarkListScreen } from "../screens/BenchmarkListScreen.js";
import { BenchmarkDetailScreen } from "../screens/BenchmarkDetailScreen.js";
import { BenchmarkRunListScreen } from "../screens/BenchmarkRunListScreen.js";
import { BenchmarkRunDetailScreen } from "../screens/BenchmarkRunDetailScreen.js";
import { ScenarioRunListScreen } from "../screens/ScenarioRunListScreen.js";
import { ScenarioRunDetailScreen } from "../screens/ScenarioRunDetailScreen.js";
import { BenchmarkJobListScreen } from "../screens/BenchmarkJobListScreen.js";
import { BenchmarkJobDetailScreen } from "../screens/BenchmarkJobDetailScreen.js";
import { BenchmarkJobCreateScreen } from "../screens/BenchmarkJobCreateScreen.js";

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
        case "devbox-exec":
        case "devbox-create":
          // Clear devbox data when leaving devbox screens
          // Keep cache if we're still in devbox context
          if (!currentScreen.startsWith("devbox")) {
            useDevboxStore.getState().clearAll();
          }
          break;

        case "blueprint-list":
        case "blueprint-detail":
        case "blueprint-logs":
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

        case "network-policy-list":
        case "network-policy-detail":
        case "network-policy-create":
          if (!currentScreen.startsWith("network-policy")) {
            useNetworkPolicyStore.getState().clearAll();
          }
          break;

        case "object-list":
        case "object-detail":
          if (!currentScreen.startsWith("object")) {
            useObjectStore.getState().clearAll();
          }
          break;

        case "benchmark-menu":
        case "benchmark-list":
        case "benchmark-detail":
        case "benchmark-run-list":
        case "benchmark-run-detail":
        case "scenario-run-list":
        case "scenario-run-detail":
          if (
            !currentScreen.startsWith("benchmark") &&
            !currentScreen.startsWith("scenario")
          ) {
            useBenchmarkStore.getState().clearAll();
          }
          break;

        case "benchmark-job-list":
        case "benchmark-job-detail":
        case "benchmark-job-create":
          if (!currentScreen.startsWith("benchmark-job")) {
            useBenchmarkJobStore.getState().clearAll();
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
      {currentScreen === "settings-menu" && (
        <SettingsMenuScreen key={currentScreen} {...params} />
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
      {currentScreen === "devbox-exec" && (
        <DevboxExecScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "devbox-create" && (
        <DevboxCreateScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "blueprint-list" && (
        <BlueprintListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "blueprint-detail" && (
        <BlueprintDetailScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "blueprint-logs" && (
        <BlueprintLogsScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "snapshot-list" && (
        <SnapshotListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "snapshot-detail" && (
        <SnapshotDetailScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "network-policy-list" && (
        <NetworkPolicyListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "network-policy-detail" && (
        <NetworkPolicyDetailScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "network-policy-create" && (
        <NetworkPolicyCreateScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "secret-list" && (
        <SecretListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "secret-detail" && (
        <SecretDetailScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "secret-create" && (
        <SecretCreateScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "object-list" && (
        <ObjectListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "object-detail" && (
        <ObjectDetailScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "ssh-session" && (
        <SSHSessionScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "benchmark-menu" && (
        <BenchmarkMenuScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "benchmark-list" && (
        <BenchmarkListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "benchmark-detail" && (
        <BenchmarkDetailScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "benchmark-run-list" && (
        <BenchmarkRunListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "benchmark-run-detail" && (
        <BenchmarkRunDetailScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "scenario-run-list" && (
        <ScenarioRunListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "scenario-run-detail" && (
        <ScenarioRunDetailScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "benchmark-job-list" && (
        <BenchmarkJobListScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "benchmark-job-detail" && (
        <BenchmarkJobDetailScreen key={currentScreen} {...params} />
      )}
      {currentScreen === "benchmark-job-create" && (
        <BenchmarkJobCreateScreen key={currentScreen} {...params} />
      )}
      {!KNOWN_SCREENS.has(currentScreen) && (
        <UnknownScreen key={currentScreen} screenName={currentScreen} />
      )}
    </ErrorBoundary>
  );
}

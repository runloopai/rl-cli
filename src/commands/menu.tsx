import React from "react";
import { render, useApp } from "ink";
import { runSSHSession, type SSHSessionConfig } from "../utils/sshSession.js";
import {
  enableSynchronousUpdates,
  disableSynchronousUpdates,
} from "../utils/terminalSync.js";
import { Router } from "../router/Router.js";
import { useNavigationStore } from "../store/navigationStore.js";
import type { ScreenName } from "../store/navigationStore.js";

// Import screen components
import { MenuScreen } from "../screens/MenuScreen.js";
import { DevboxListScreen } from "../screens/DevboxListScreen.js";
import { DevboxDetailScreen } from "../screens/DevboxDetailScreen.js";
import { DevboxActionsScreen } from "../screens/DevboxActionsScreen.js";
import { DevboxCreateScreen } from "../screens/DevboxCreateScreen.js";
import { BlueprintListScreen } from "../screens/BlueprintListScreen.js";
import { SnapshotListScreen } from "../screens/SnapshotListScreen.js";

interface AppProps {
  onSSHRequest: (config: SSHSessionConfig) => void;
  initialScreen?: ScreenName;
  focusDevboxId?: string;
}

const App: React.FC<AppProps> = ({
  onSSHRequest,
  initialScreen = "menu",
  focusDevboxId,
}) => {
  const { exit } = useApp();
  const navigate = useNavigationStore((state) => state.navigate);

  // Set initial screen on mount
  React.useEffect(() => {
    if (initialScreen !== "menu") {
      navigate(initialScreen, { focusDevboxId });
    }
  }, []);

  // Define all screen components
  const screens = React.useMemo(
    () => ({
      menu: MenuScreen,
      "devbox-list": (props: any) => (
        <DevboxListScreen {...props} onSSHRequest={onSSHRequest} />
      ),
      "devbox-detail": (props: any) => (
        <DevboxDetailScreen {...props} onSSHRequest={onSSHRequest} />
      ),
      "devbox-actions": (props: any) => (
        <DevboxActionsScreen {...props} onSSHRequest={onSSHRequest} />
      ),
      "devbox-create": DevboxCreateScreen,
      "blueprint-list": BlueprintListScreen,
      "blueprint-detail": BlueprintListScreen, // TODO: Create proper detail screen
      "snapshot-list": SnapshotListScreen,
      "snapshot-detail": SnapshotListScreen, // TODO: Create proper detail screen
    }),
    [onSSHRequest],
  );

  return <Router screens={screens} />;
};

export async function runMainMenu(
  initialScreen: ScreenName = "menu",
  focusDevboxId?: string,
) {
  // Enter alternate screen buffer for fullscreen experience (like top/vim)
  process.stdout.write("\x1b[?1049h");

  // DISABLED: Testing if terminal doesn't support synchronous updates properly
  // enableSynchronousUpdates();

  let sshSessionConfig: SSHSessionConfig | null = null;
  let shouldContinue = true;
  let currentInitialScreen = initialScreen;
  let currentFocusDevboxId = focusDevboxId;

  while (shouldContinue) {
    sshSessionConfig = null;

    try {
      const { waitUntilExit } = render(
        <App
          onSSHRequest={(config) => {
            sshSessionConfig = config;
          }}
          initialScreen={currentInitialScreen}
          focusDevboxId={currentFocusDevboxId}
        />,
        {
          patchConsole: false,
          exitOnCtrlC: false,
        },
      );
      await waitUntilExit();
      shouldContinue = false;
    } catch (error) {
      console.error("Error in menu:", error);
      shouldContinue = false;
    }

    // If SSH was requested, handle it now after Ink has exited
    if (sshSessionConfig) {
      const result = await runSSHSession(sshSessionConfig);

      if (result.shouldRestart) {
        console.log(`\nSSH session ended. Returning to menu...\n`);
        await new Promise((resolve) => setTimeout(resolve, 500));

        currentInitialScreen = "devbox-list";
        currentFocusDevboxId = result.returnToDevboxId;
        shouldContinue = true;
      } else {
        shouldContinue = false;
      }
    }
  }

  // Disable synchronous updates
  // disableSynchronousUpdates();

  // Exit alternate screen buffer
  process.stdout.write("\x1b[?1049l");

  process.exit(0);
}

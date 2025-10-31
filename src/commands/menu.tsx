import React from "react";
import { render } from "ink";
import { runSSHSession, type SSHSessionConfig } from "../utils/sshSession.js";
import { enterAlternateScreen, exitAlternateScreen } from "../utils/screen.js";

import { Router } from "../router/Router.js";
import { NavigationProvider } from "../store/navigationStore.js";
import type { ScreenName } from "../store/navigationStore.js";

interface AppProps {
  onSSHRequest: (config: SSHSessionConfig) => void;
  initialScreen?: ScreenName;
  focusDevboxId?: string;
}

function AppInner({
  onSSHRequest,
}: {
  onSSHRequest: (config: SSHSessionConfig) => void;
}) {
  // NavigationProvider already handles initialScreen and initialParams
  // No need for useEffect here - provider sets state on mount
  return <Router onSSHRequest={onSSHRequest} />;
}

function App({
  onSSHRequest,
  initialScreen = "menu",
  focusDevboxId,
}: AppProps) {
  return (
    <NavigationProvider
      initialScreen={initialScreen}
      initialParams={focusDevboxId ? { focusDevboxId } : {}}
    >
      <AppInner onSSHRequest={onSSHRequest} />
    </NavigationProvider>
  );
}

export async function runMainMenu(
  initialScreen: ScreenName = "menu",
  focusDevboxId?: string,
) {
  // Enter alternate screen buffer for fullscreen experience (like top/vim)
  enterAlternateScreen();

  let sshSessionConfig: SSHSessionConfig | null = null;
  let shouldContinue = true;
  let currentInitialScreen = initialScreen;
  let currentFocusDevboxId = focusDevboxId;

  while (shouldContinue) {
    sshSessionConfig = null;

    try {
      const { waitUntilExit } = render(
        <App
          key={`app-${currentInitialScreen}-${currentFocusDevboxId}`}
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
  exitAlternateScreen();

  process.exit(0);
}

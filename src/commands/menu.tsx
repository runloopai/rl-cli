import React from "react";
import { render, useApp } from "ink";
import { MainMenu } from "../components/MainMenu.js";
import { runSSHSession, type SSHSessionConfig } from "../utils/sshSession.js";
import { enableSynchronousUpdates, disableSynchronousUpdates } from "../utils/terminalSync.js";

// Import list components dynamically to avoid circular deps
type Screen = "menu" | "devboxes" | "blueprints" | "snapshots";

// Import the UI components directly
import { ListDevboxesUI } from "./devbox/list.js";
import { ListBlueprintsUI } from "./blueprint/list.js";
import { ListSnapshotsUI } from "./snapshot/list.js";

import { Box } from "ink";

interface AppProps {
  onSSHRequest: (config: SSHSessionConfig) => void;
  initialScreen?: Screen;
  focusDevboxId?: string;
}

const App: React.FC<AppProps> = ({
  onSSHRequest,
  initialScreen = "menu",
  focusDevboxId,
}) => {
  const { exit } = useApp();
  const [currentScreen, setCurrentScreen] =
    React.useState<Screen>(initialScreen);

  const handleMenuSelect = React.useCallback((key: string) => {
    setCurrentScreen(key as Screen);
  }, []);

  const handleBack = React.useCallback(() => {
    setCurrentScreen("menu");
  }, []);

  const handleExit = React.useCallback(() => {
    exit();
  }, [exit]);

  // Return components directly without wrapper Box (test for flashing)
  if (currentScreen === "menu") {
    return <MainMenu onSelect={handleMenuSelect} />;
  }
  if (currentScreen === "devboxes") {
    return (
      <ListDevboxesUI
        onBack={handleBack}
        onExit={handleExit}
        onSSHRequest={onSSHRequest}
        focusDevboxId={focusDevboxId}
      />
    );
  }
  if (currentScreen === "blueprints") {
    return <ListBlueprintsUI onBack={handleBack} onExit={handleExit} />;
  }
  if (currentScreen === "snapshots") {
    return <ListSnapshotsUI onBack={handleBack} onExit={handleExit} />;
  }
  return null;
};

export async function runMainMenu(
  initialScreen: Screen = "menu",
  focusDevboxId?: string,
) {
  // DON'T use alternate screen buffer - it causes flashing in some terminals
  // process.stdout.write("\x1b[?1049h");
  
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

        currentInitialScreen = "devboxes";
        currentFocusDevboxId = result.returnToDevboxId;
        shouldContinue = true;
      } else {
        shouldContinue = false;
      }
    }
  }

  // Disable synchronous updates
  // disableSynchronousUpdates();

  process.exit(0);
}

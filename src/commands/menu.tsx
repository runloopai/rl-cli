import React from "react";
import { render, useApp } from "ink";
import { MainMenu } from "../components/MainMenu.js";
import { runSSHSession, type SSHSessionConfig } from "../utils/sshSession.js";

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
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const handleMenuSelect = (key: string) => {
    setCurrentScreen(key as Screen);
  };

  const handleBack = () => {
    setCurrentScreen("menu");
  };

  const handleExit = () => {
    exit();
  };

  // Wrap everything in a full-height container
  return (
    <Box flexDirection="column" minHeight={process.stdout.rows || 24}>
      {currentScreen === "menu" && <MainMenu onSelect={handleMenuSelect} />}
      {currentScreen === "devboxes" && (
        <ListDevboxesUI
          onBack={handleBack}
          onExit={handleExit}
          onSSHRequest={onSSHRequest}
          focusDevboxId={focusDevboxId}
        />
      )}
      {currentScreen === "blueprints" && (
        <ListBlueprintsUI onBack={handleBack} onExit={handleExit} />
      )}
      {currentScreen === "snapshots" && (
        <ListSnapshotsUI onBack={handleBack} onExit={handleExit} />
      )}
    </Box>
  );
};

export async function runMainMenu(
  initialScreen: Screen = "menu",
  focusDevboxId?: string,
) {
  // Enter alternate screen buffer once at the start
  process.stdout.write("\x1b[?1049h");

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
      );
      await waitUntilExit();
      shouldContinue = false;
    } catch (error) {
      console.error("Error in menu:", error);
      shouldContinue = false;
    }

    // If SSH was requested, handle it now after Ink has exited
    if (sshSessionConfig) {
      // Exit alternate screen buffer for SSH
      process.stdout.write("\x1b[?1049l");

      const result = await runSSHSession(sshSessionConfig);

      if (result.shouldRestart) {
        console.clear();
        console.log(`\nSSH session ended. Returning to menu...\n`);
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Re-enter alternate screen buffer and return to devboxes list
        process.stdout.write("\x1b[?1049h");
        currentInitialScreen = "devboxes";
        currentFocusDevboxId = result.returnToDevboxId;
        shouldContinue = true;
      } else {
        shouldContinue = false;
      }
    }
  }

  // Exit alternate screen buffer once at the end
  process.stdout.write("\x1b[?1049l");

  process.exit(0);
}

import React from "react";
import { render } from "ink";
import {
  enterAlternateScreenBuffer,
  exitAlternateScreenBuffer,
} from "../utils/screen.js";

import { Router } from "../router/Router.js";
import { NavigationProvider } from "../store/navigationStore.js";
import type { ScreenName } from "../store/navigationStore.js";

function AppInner() {
  // NavigationProvider already handles initialScreen and initialParams
  // No need for useEffect here - provider sets state on mount
  return <Router />;
}

function App({
  initialScreen = "menu",
  focusDevboxId,
}: {
  initialScreen?: ScreenName;
  focusDevboxId?: string;
}) {
  return (
    <NavigationProvider
      initialScreen={initialScreen}
      initialParams={focusDevboxId ? { focusDevboxId } : {}}
    >
      <AppInner />
    </NavigationProvider>
  );
}

export async function runMainMenu(
  initialScreen: ScreenName = "menu",
  focusDevboxId?: string,
) {
  enterAlternateScreenBuffer();

  try {
    const { waitUntilExit } = render(
      <App
        key={`app-${initialScreen}-${focusDevboxId}`}
        initialScreen={initialScreen}
        focusDevboxId={focusDevboxId}
      />,
      {
        patchConsole: false,
        exitOnCtrlC: false,
      },
    );
    await waitUntilExit();
  } catch (error) {
    console.error("Error in menu:", error);
  }

  exitAlternateScreenBuffer();

  process.exit(0);
}

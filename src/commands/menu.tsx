import React from "react";
import { render } from "ink";
import {
  enterAlternateScreenBuffer,
  exitAlternateScreenBuffer,
  clearScreen,
} from "../utils/screen.js";
import { processUtils } from "../utils/processUtils.js";

import { Router } from "../router/Router.js";
import { NavigationProvider } from "../store/navigationStore.js";
import { BetaFeatureProvider } from "../store/betaFeatureStore.js";
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
    <BetaFeatureProvider>
      <NavigationProvider
        initialScreen={initialScreen}
        initialParams={focusDevboxId ? { focusDevboxId } : {}}
      >
        <AppInner />
      </NavigationProvider>
    </BetaFeatureProvider>
  );
}

export async function runMainMenu(
  initialScreen: ScreenName = "menu",
  focusDevboxId?: string,
) {
  enterAlternateScreenBuffer();
  clearScreen(); // Ensure cursor is at top-left before Ink renders

  // WORKAROUND for Bun: Manually resume stdin as Bun doesn't do it automatically
  // See: https://github.com/oven-sh/bun/issues/6862
  // This is required for Ink's useInput hook to work properly with Bun
  // Safe to call in Node.js too - it's idempotent
  const globalWithBun = globalThis as typeof globalThis & { Bun?: unknown };
  if (globalWithBun.Bun) {
    process.stdin.resume();
  }

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

  processUtils.exit(0);
}

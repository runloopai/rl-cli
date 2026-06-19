#!/usr/bin/env node

import {
  exitAlternateScreenBuffer,
  isInAlternateScreenBuffer,
} from "./utils/screen.js";
import { processUtils } from "./utils/processUtils.js";
import { createProgram } from "./utils/commands.js";
import { getApiKeyErrorMessage, checkBaseDomain } from "./utils/config.js";

// Global Ctrl+C handler to ensure it always exits
processUtils.on("SIGINT", () => {
  // Only restore the alternate screen buffer if we actually entered it.
  // Unconditionally sending the exit sequence when no TUI is active causes
  // the terminal to restore a stale saved-cursor position, jumping the
  // cursor and garbling any plain-text output (e.g. `rli d ssh` wait loop).
  if (isInAlternateScreenBuffer()) {
    exitAlternateScreenBuffer();
  }
  processUtils.stdout.write("\n");
  processUtils.exit(130); // Standard exit code for SIGINT
});

const program = createProgram();

// Main CLI entry point
(async () => {
  // Initialize theme system early (before any UI rendering)
  const { initializeTheme } = await import("./utils/theme.js");
  await initializeTheme();

  checkBaseDomain();

  // Check if API key is configured (except for mcp commands)
  const args = process.argv.slice(2);
  if (!process.env.RUNLOOP_API_KEY) {
    console.error(getApiKeyErrorMessage());
    processUtils.exit(1);
    return; // Ensure execution stops
  }

  // If no command provided, show main menu
  if (args.length === 0) {
    const { runMainMenu } = await import("./commands/menu.js");
    runMainMenu();
  } else {
    program.parse();
  }
})();

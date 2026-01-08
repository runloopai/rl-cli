#!/usr/bin/env node

import { exitAlternateScreenBuffer } from "./utils/screen.js";
import { processUtils } from "./utils/processUtils.js";
import { createProgram } from "./utils/commands.js";

// Global Ctrl+C handler to ensure it always exits
processUtils.on("SIGINT", () => {
  // Force exit immediately, clearing alternate screen buffer
  exitAlternateScreenBuffer();
  processUtils.stdout.write("\n");
  processUtils.exit(130); // Standard exit code for SIGINT
});

const program = createProgram();


// Main CLI entry point
(async () => {
  // Initialize theme system early (before any UI rendering)
  const { initializeTheme } = await import("./utils/theme.js");
  await initializeTheme();

  // Check if API key is configured (except for mcp commands)
  const args = process.argv.slice(2);
  if (!process.env.RUNLOOP_API_KEY) {
    console.error(`
❌ API key not configured.

To get started:
1. Go to https://platform.runloop.ai/settings and create an API key
2. Set the environment variable:

   export RUNLOOP_API_KEY=your_api_key_here

To make it permanent, add this line to your shell config:
   • For zsh:  echo 'export RUNLOOP_API_KEY=your_api_key_here' >> ~/.zshrc
   • For bash: echo 'export RUNLOOP_API_KEY=your_api_key_here' >> ~/.bashrc

Then restart your terminal or run: source ~/.zshrc (or ~/.bashrc)
`);
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

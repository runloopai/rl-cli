import {
  enterAlternateScreenBuffer,
  exitAlternateScreenBuffer,
} from "./screen.js";

/**
 * Wrapper for interactive commands that need alternate screen buffer management
 */
export async function runInteractiveCommand(command: () => Promise<void>) {
  // Enter alternate screen buffer
  enterAlternateScreenBuffer();

  try {
    await command();
  } finally {
    // Exit alternate screen buffer
    exitAlternateScreenBuffer();
  }
}

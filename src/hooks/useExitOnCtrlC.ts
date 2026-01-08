/**
 * Hook to handle Ctrl+C (SIGINT) consistently across all screens
 * Exits the program with proper cleanup of alternate screen buffer
 */
import { useInput } from "ink";
import { exitAlternateScreenBuffer } from "../utils/screen.js";
import { processUtils } from "../utils/processUtils.js";

export function useExitOnCtrlC(): void {
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exitAlternateScreenBuffer();
      processUtils.exit(130); // Standard exit code for SIGINT
    }
  });
}

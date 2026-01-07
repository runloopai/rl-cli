/**
 * InteractiveSpawn - Custom component for running interactive subprocesses
 * Based on Ink's subprocess-output example pattern
 * Handles proper TTY allocation for interactive commands like SSH
 */
import React from "react";
import { spawn, ChildProcess } from "child_process";
import {
  showCursor,
  clearScreen,
  enterAlternateScreenBuffer,
} from "../utils/screen.js";

interface InteractiveSpawnProps {
  command: string;
  args: string[];
  onExit?: (code: number | null) => void;
  onError?: (error: Error) => void;
}

/**
 * Releases terminal control from Ink so a subprocess can take over.
 * This directly manipulates stdin to bypass Ink's input handling.
 */
function releaseTerminal(): void {
  // Pause stdin to stop Ink from reading input
  process.stdin.pause();

  // Disable raw mode so the subprocess can control terminal echo and line buffering
  // SSH needs to set its own terminal modes
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }

  // Reset terminal attributes (SGR reset) - clears any colors/styles Ink may have set
  if (process.stdout.isTTY) {
    process.stdout.write("\x1b[0m");
  }

  // Show cursor - Ink may have hidden it, and subprocesses expect it to be visible
  showCursor();

  // Flush stdout to ensure all pending writes are complete before handoff
  if (process.stdout.isTTY) {
    process.stdout.write("");
  }
}

/**
 * Restores terminal control to Ink after subprocess exits.
 */
function restoreTerminal(): void {
  // Clear the screen to remove subprocess output before Ink renders
  clearScreen();

  // Re-enter alternate screen buffer for Ink's fullscreen UI
  enterAlternateScreenBuffer();

  // Re-enable raw mode for Ink's input handling
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }

  // Resume stdin so Ink can read input again
  process.stdin.resume();
}

export const InteractiveSpawn: React.FC<InteractiveSpawnProps> = ({
  command,
  args,
  onExit,
  onError,
}) => {
  const processRef = React.useRef<ChildProcess | null>(null);
  const hasSpawnedRef = React.useRef(false);

  // Use a stable string representation of args for dependency comparison
  const argsKey = React.useMemo(() => JSON.stringify(args), [args]);

  React.useEffect(() => {
    // Only spawn once - prevent re-spawning if component re-renders
    if (hasSpawnedRef.current) {
      return;
    }
    hasSpawnedRef.current = true;

    // Release terminal from Ink's control
    releaseTerminal();

    // Use setImmediate to ensure terminal state is released without noticeable delay
    // This is faster than setTimeout and ensures the event loop has processed the release
    setImmediate(() => {
      // Spawn the process with inherited stdio for proper TTY allocation
      const child = spawn(command, args, {
        stdio: "inherit", // This allows the process to use the terminal directly
        shell: false,
      });

      processRef.current = child;

      // Handle process exit
      child.on("exit", (code, _signal) => {
        processRef.current = null;
        hasSpawnedRef.current = false;

        // Restore terminal control to Ink
        restoreTerminal();

        if (onExit) {
          onExit(code);
        }
      });

      // Handle spawn errors
      child.on("error", (error) => {
        processRef.current = null;
        hasSpawnedRef.current = false;

        // Restore terminal control to Ink
        restoreTerminal();

        if (onError) {
          onError(error);
        }
      });
    });

    // Cleanup function - kill the process if component unmounts
    return () => {
      if (processRef.current && !processRef.current.killed) {
        processRef.current.kill("SIGTERM");
      }
      // Restore terminal state on cleanup
      restoreTerminal();
      hasSpawnedRef.current = false;
    };
  }, [command, argsKey, onExit, onError]);

  // This component doesn't render anything - it just manages the subprocess
  // The subprocess output goes directly to the terminal via stdio: "inherit"
  return null;
};

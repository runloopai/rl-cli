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
  exitAlternateScreenBuffer,
  enterAlternateScreenBuffer,
} from "../utils/screen.js";
import { processUtils } from "../utils/processUtils.js";

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
  // Exit alternate screen buffer so the subprocess runs in the normal screen buffer.
  // This prevents Ink's ongoing renders (which target the alt buffer) from
  // interfering with the subprocess's terminal I/O, which was causing characters
  // to be lost at the start of the session.
  exitAlternateScreenBuffer();

  // Pause stdin to stop Ink from reading input
  process.stdin.pause();

  // NOTE: We intentionally do NOT call setRawMode(false) here. Leaving the terminal
  // in raw mode means characters typed during the subprocess connection setup remain
  // immediately available in the kernel buffer (no canonical line-buffering). Calling
  // setRawMode(false) would invoke tcsetattr(TCSAFLUSH) which discards pending input
  // and switches to canonical mode where keystrokes are held until Enter is pressed.

  // Reset terminal attributes (SGR reset) - clears any colors/styles Ink may have set
  if (processUtils.stdout.isTTY) {
    processUtils.stdout.write("\x1b[0m");
  }

  // Show cursor - Ink may have hidden it, and subprocesses expect it to be visible
  showCursor();
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
  if (processUtils.stdin.isTTY && processUtils.stdin.setRawMode) {
    processUtils.stdin.setRawMode(true);
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

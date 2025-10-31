/**
 * InteractiveSpawn - Custom component for running interactive subprocesses
 * Based on Ink's subprocess-output example pattern
 * Handles proper TTY allocation for interactive commands like SSH
 */
import React from "react";
import { spawn, ChildProcess } from "child_process";
import { exitAlternateScreen, enterAlternateScreen } from "../utils/screen.js";

interface InteractiveSpawnProps {
  command: string;
  args: string[];
  onExit?: (code: number | null) => void;
  onError?: (error: Error) => void;
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

    // Exit alternate screen so SSH gets a clean terminal
    exitAlternateScreen();

    // Small delay to ensure terminal state is clean
    setTimeout(() => {
      // Spawn the process with inherited stdio for proper TTY allocation
      const child = spawn(command, args, {
        stdio: "inherit", // This allows the process to use the terminal directly
        shell: false,
      });

      processRef.current = child;

      // Handle process exit
      child.on("exit", (code, signal) => {
        processRef.current = null;
        hasSpawnedRef.current = false;

        // Re-enter alternate screen after process exits
        enterAlternateScreen();

        if (onExit) {
          onExit(code);
        }
      });

      // Handle spawn errors
      child.on("error", (error) => {
        processRef.current = null;
        hasSpawnedRef.current = false;

        // Re-enter alternate screen on error
        enterAlternateScreen();

        if (onError) {
          onError(error);
        }
      });
    }, 50);

    // Cleanup function - kill the process if component unmounts
    return () => {
      if (processRef.current && !processRef.current.killed) {
        processRef.current.kill("SIGTERM");
      }
      hasSpawnedRef.current = false;
    };
  }, [command, argsKey, onExit, onError]);

  // This component doesn't render anything - it just manages the subprocess
  // The subprocess output goes directly to the terminal via stdio: "inherit"
  return null;
};


/**
 * ExecViewer - Unified execution viewer for both sync and async modes
 * Supports kill, leave-early, and run-another for both modes
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import figures from "figures";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { colors } from "../utils/theme.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import {
  execCommandAsync,
  getExecution,
  killExecution,
} from "../services/devboxService.js";
import { getClient } from "../utils/client.js";

type ExecStatus = "starting" | "running" | "completed" | "killed" | "failed";

interface ExecViewerProps {
  devboxId: string;
  command: string;
  breadcrumbItems: Array<{ label: string; active?: boolean }>;
  onBack: () => void;
  onRunAnother: () => void;
  // Optional: existing execution ID to resume (survives remounts)
  existingExecutionId?: string | null;
  // Optional: callback when execution starts (to save ID in parent)
  onExecutionStart?: (executionId: string) => void;
}

export const ExecViewer = ({
  devboxId,
  command,
  breadcrumbItems,
  onBack,
  onRunAnother,
  existingExecutionId,
  onExecutionStart,
}: ExecViewerProps) => {
  // State
  const [status, setStatus] = React.useState<ExecStatus>(
    existingExecutionId ? "running" : "starting"
  );
  const [executionId, setExecutionId] = React.useState<string | null>(
    existingExecutionId || null
  );
  const [stdout, setStdout] = React.useState("");
  const [stderr, setStderr] = React.useState("");
  const [exitCode, setExitCode] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [scroll, setScroll] = React.useState(0);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);
  const [startTime] = React.useState(Date.now());
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [autoScroll, setAutoScroll] = React.useState(true);

  // Refs for cleanup
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const streamCleanupRef = React.useRef<(() => void) | null>(null);
  
  // Ref for callback to avoid stale closures
  const onExecutionStartRef = React.useRef(onExecutionStart);
  onExecutionStartRef.current = onExecutionStart;

  // Viewport calculation
  const execViewport = useViewportHeight({ overhead: 16, minHeight: 10 });

  // Handle Ctrl+C
  useExitOnCtrlC();

  // Elapsed time updater
  React.useEffect(() => {
    if (status === "running" || status === "starting") {
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 100);
      return () => clearInterval(timer);
    }
  }, [status, startTime]);

  // Track if execution has started to prevent re-execution on re-renders
  const executionStartedRef = React.useRef(false);
  // Store the initial existingExecutionId to detect true remounts vs just prop updates
  const initialExistingExecutionIdRef = React.useRef(existingExecutionId);

  // Start execution on mount (only once), or resume if existingExecutionId provided
  React.useEffect(() => {
    // Prevent re-execution if already started (e.g., during resize re-renders)
    // Also ignore if existingExecutionId changed from null to a value (that's us reporting back)
    if (executionStartedRef.current) {
      // Only resume if this is a true remount (component was unmounted and remounted with an ID)
      // Not if we just reported the ID back to parent
      return;
    }
    executionStartedRef.current = true;

    const startOrResumeExecution = async () => {
      // If we have an existing execution ID on initial mount, resume
      if (initialExistingExecutionIdRef.current) {
        try {
          // Fetch current output state before resuming
          const currentState = await getExecution(devboxId, initialExistingExecutionIdRef.current);
          setStdout(currentState.stdout);
          setStderr(currentState.stderr);
          if (currentState.status === "completed") {
            setStatus("completed");
            setExitCode(currentState.exit_code ?? 0);
            return;
          }
        } catch {
          // If fetch fails, just continue with polling
        }

        // Always use polling for resume - more reliable than trying to reconnect streams
        startPolling(initialExistingExecutionIdRef.current);
        return;
      }

      // Start a new execution
      try {
        const result = await execCommandAsync(devboxId, command);
        setExecutionId(result.executionId);
        setStatus("running");

        // Report execution ID to parent so it survives remounts
        if (onExecutionStartRef.current) {
          onExecutionStartRef.current(result.executionId);
        }

        // Always use streaming for live output
        startStreaming(result.executionId);
      } catch (err) {
        setError((err as Error).message);
        setStatus("failed");
      }
    };

    startOrResumeExecution();

    // Cleanup on unmount only - not on dep changes since executionStartedRef prevents re-run
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (streamCleanupRef.current) {
        streamCleanupRef.current();
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  // Only depend on values that don't change during execution
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devboxId, command]);

  // Start streaming for live output
  const startStreaming = async (execId: string) => {
    const client = getClient();
    abortControllerRef.current = new AbortController();

    let stdoutOffset = 0;
    let stderrOffset = 0;
    let isCompleted = false;

    // Poll for status while streaming
    const statusPollInterval = setInterval(async () => {
      try {
        const result = await getExecution(devboxId, execId);
        if (result.status === "completed") {
          isCompleted = true;
          // Get final output to ensure we have everything
          setStdout(result.stdout);
          setStderr(result.stderr);
          setExitCode(result.exit_code ?? 0);
          setStatus("completed");
          clearInterval(statusPollInterval);
        }
      } catch {
        // Ignore errors during status polling
      }
    }, 1000);

    // Stream stdout
    const streamStdout = async () => {
      try {
        const stream = await client.devboxes.executions.streamStdoutUpdates(
          devboxId,
          execId,
          { offset: stdoutOffset.toString() },
        );

        for await (const chunk of stream) {
          if (abortControllerRef.current?.signal.aborted || isCompleted) break;
          if (chunk.output) {
            setStdout((prev) => {
              const newOutput = prev + chunk.output;
              // Truncate if too long
              if (newOutput.length > 10000) {
                return newOutput.substring(newOutput.length - 10000);
              }
              return newOutput;
            });
            if (chunk.offset !== undefined) {
              stdoutOffset = chunk.offset;
            }
          }
        }
      } catch {
        // Stream ended or error - fall back to polling if not completed
        // Note: Don't check status here as it may be stale due to closure
        if (!isCompleted) {
          startPolling(execId);
        }
      }
    };

    // Stream stderr
    const streamStderr = async () => {
      try {
        const stream = await client.devboxes.executions.streamStderrUpdates(
          devboxId,
          execId,
          { offset: stderrOffset.toString() },
        );

        for await (const chunk of stream) {
          if (abortControllerRef.current?.signal.aborted || isCompleted) break;
          if (chunk.output) {
            setStderr((prev) => {
              const newOutput = prev + chunk.output;
              // Truncate if too long
              if (newOutput.length > 10000) {
                return newOutput.substring(newOutput.length - 10000);
              }
              return newOutput;
            });
            if (chunk.offset !== undefined) {
              stderrOffset = chunk.offset;
            }
          }
        }
      } catch {
        // Stream ended or error - ignore, status polling will handle completion
      }
    };

    // Start both streams
    streamStdout();
    streamStderr();

    streamCleanupRef.current = () => {
      clearInterval(statusPollInterval);
      abortControllerRef.current?.abort();
    };
  };

  // Start polling (sync mode or fallback)
  const startPolling = (execId: string) => {
    const poll = async () => {
      try {
        const result = await getExecution(devboxId, execId);
        setStdout(result.stdout);
        setStderr(result.stderr);

        if (result.status === "completed") {
          setExitCode(result.exit_code ?? 0);
          setStatus("completed");
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      } catch (err) {
        setError((err as Error).message);
        setStatus("failed");
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      }
    };

    // Initial poll
    poll();

    // Continue polling every 500ms
    pollIntervalRef.current = setInterval(poll, 500);
  };

  // Kill execution
  const handleKill = async () => {
    if (!executionId || status !== "running") return;

    try {
      await killExecution(devboxId, executionId);
      setStatus("killed");
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (streamCleanupRef.current) {
        streamCleanupRef.current();
      }
    } catch (err) {
      setError(`Failed to kill: ${(err as Error).message}`);
    }
  };

  // Copy output to clipboard
  const handleCopy = async () => {
    const output = stdout + stderr;

    const { spawn } = await import("child_process");
    const platform = process.platform;

    let cmd: string;
    let args: string[];

    if (platform === "darwin") {
      cmd = "pbcopy";
      args = [];
    } else if (platform === "win32") {
      cmd = "clip";
      args = [];
    } else {
      cmd = "xclip";
      args = ["-selection", "clipboard"];
    }

    const proc = spawn(cmd, args);
    proc.stdin.write(output);
    proc.stdin.end();

    proc.on("exit", (code) => {
      if (code === 0) {
        setCopyStatus("Copied!");
        setTimeout(() => setCopyStatus(null), 2000);
      } else {
        setCopyStatus("Failed");
        setTimeout(() => setCopyStatus(null), 2000);
      }
    });

    proc.on("error", () => {
      setCopyStatus("Not supported");
      setTimeout(() => setCopyStatus(null), 2000);
    });
  };

  // Handle input
  useInput((input, key) => {
    const isRunning = status === "running" || status === "starting";
    const isComplete =
      status === "completed" || status === "killed" || status === "failed";

    // Kill command
    if (input === "k" && isRunning) {
      handleKill();
      return;
    }

    // Run another (after completion)
    if (input === "r" && isComplete) {
      onRunAnother();
      return;
    }

    // Copy output (ignore if Ctrl+C for quit)
    if (input === "c" && !key.ctrl) {
      handleCopy();
      return;
    }

    // Back/leave
    if (input === "q" || key.escape) {
      onBack();
      return;
    }

    // Return after completion
    if (key.return && isComplete) {
      onBack();
      return;
    }

    // Scrolling
    const allLines = [...stdout.split("\n"), ...stderr.split("\n")].filter(
      (line) => line !== "",
    );
    const maxScroll = Math.max(
      0,
      allLines.length - execViewport.viewportHeight,
    );

    if (key.upArrow || input === "k") {
      setScroll(Math.max(0, scroll - 1));
      setAutoScroll(false);
    } else if (key.downArrow || input === "j") {
      const newScroll = Math.min(maxScroll, scroll + 1);
      setScroll(newScroll);
      setAutoScroll(newScroll >= maxScroll);
    } else if (key.pageUp) {
      setScroll(Math.max(0, scroll - 10));
      setAutoScroll(false);
    } else if (key.pageDown) {
      const newScroll = Math.min(maxScroll, scroll + 10);
      setScroll(newScroll);
      setAutoScroll(newScroll >= maxScroll);
    } else if (input === "g") {
      setScroll(0);
      setAutoScroll(false);
    } else if (input === "G") {
      setScroll(maxScroll);
      setAutoScroll(true);
    }
  });

  // Auto-scroll to bottom when new output arrives (for both modes)
  // Simple approach: if autoScroll is enabled, always go to bottom
  // User actions (scroll up) disable autoScroll, scroll to bottom re-enables it
  React.useEffect(() => {
    if (!autoScroll) return;
    
    const allLines = [...stdout.split("\n"), ...stderr.split("\n")].filter(
      (line) => line !== "",
    );
    const maxScroll = Math.max(
      0,
      allLines.length - execViewport.viewportHeight,
    );
    
    setScroll(maxScroll);
  }, [stdout, stderr, autoScroll, execViewport.viewportHeight]);

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Get status display
  const getStatusDisplay = () => {
    switch (status) {
      case "starting":
        return { text: "Starting...", color: colors.info, icon: "●" };
      case "running":
        return { text: `Running (${formatTime(elapsedTime)})`, color: colors.warning, icon: "●" };
      case "completed":
        return {
          text: `Completed (exit: ${exitCode}) in ${formatTime(elapsedTime)}`,
          color: exitCode === 0 ? colors.success : colors.error,
          icon: exitCode === 0 ? figures.tick : figures.cross,
        };
      case "killed":
        return { text: `Killed after ${formatTime(elapsedTime)}`, color: colors.warning, icon: figures.cross };
      case "failed":
        return { text: "Failed", color: colors.error, icon: figures.cross };
      default:
        return { text: "Unknown", color: colors.textDim, icon: "?" };
    }
  };

  const statusDisplay = getStatusDisplay();
  const isRunning = status === "running" || status === "starting";

  // Prepare output lines
  const stdoutLines = stdout ? stdout.split("\n") : [];
  const stderrLines = stderr ? stderr.split("\n") : [];
  const allLines = [...stdoutLines, ...stderrLines].filter(
    (line) => line !== "",
  );

  const viewportHeight = execViewport.viewportHeight;
  const maxScroll = Math.max(0, allLines.length - viewportHeight);
  const actualScroll = Math.min(scroll, maxScroll);
  const visibleLines = allLines.slice(
    actualScroll,
    actualScroll + viewportHeight,
  );
  const hasMore = actualScroll + viewportHeight < allLines.length;
  const hasLess = actualScroll > 0;

  // Get navigation tips based on state
  const getNavigationTips = () => {
    if (isRunning) {
      return [
        { key: "↑↓", label: "Scroll" },
        { key: "k", label: "Kill" },
        { key: "q/esc", label: "Leave Running" },
      ];
    } else {
      return [
        { key: "↑↓", label: "Scroll" },
        { key: "r", label: "Run Another" },
        { key: "c", label: "Copy" },
        { key: "q/esc/Enter", label: "Back" },
      ];
    }
  };

  return (
    <>
      <Breadcrumb
        items={breadcrumbItems}
      />

      {/* Command header */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.primary}
        paddingX={1}
        marginBottom={1}
      >
        <Box>
          <Text color={colors.primary} bold>
            {figures.play} Command:
          </Text>
          <Text> </Text>
          <Text color={colors.text}>
            {command.length > 80 ? command.substring(0, 80) + "..." : command}
          </Text>
        </Box>
        <Box>
          <Text color={colors.textDim} dimColor>
            Status:{" "}
          </Text>
          {isRunning && (
            <Text color={statusDisplay.color}>
              <Spinner type="dots" />{" "}
            </Text>
          )}
          <Text color={statusDisplay.color}>
            {!isRunning && `${statusDisplay.icon} `}
            {statusDisplay.text}
          </Text>
        </Box>
      </Box>

      {/* Error display */}
      {error && (
        <Box marginBottom={1}>
          <Text color={colors.error}>
            {figures.cross} Error: {error}
          </Text>
        </Box>
      )}

      {/* Output display */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.border}
        paddingX={1}
        height={viewportHeight + 2} // +2 for borders
      >
        {allLines.length === 0 && isRunning ? (
          <Box>
            <Text color={colors.info}>
              <Spinner type="dots" />
            </Text>
            <Text color={colors.textDim}>
              {" "}Waiting for output...
            </Text>
          </Box>
        ) : allLines.length === 0 ? (
          <Text color={colors.textDim} dimColor>
            No output
          </Text>
        ) : (
          visibleLines.map((line: string, index: number) => {
            const actualIndex = actualScroll + index;
            const isStderr = actualIndex >= stdoutLines.length;
            const lineColor = isStderr ? colors.error : colors.text;

            return (
              <Box key={index}>
                <Text color={lineColor}>{line}</Text>
              </Box>
            );
          })
        )}
      </Box>

      {/* Statistics bar */}
      <Box marginTop={1} paddingX={1}>
        <Text color={colors.primary} bold>
          {figures.hamburger} {allLines.length}
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          lines
        </Text>
        {allLines.length > 0 && (
          <>
            <Text color={colors.textDim} dimColor>
              {" "}
              •{" "}
            </Text>
            <Text color={colors.textDim} dimColor>
              {actualScroll + 1}-
              {Math.min(actualScroll + viewportHeight, allLines.length)} of{" "}
              {allLines.length}
            </Text>
            {hasLess && <Text color={colors.primary}> {figures.arrowUp}</Text>}
            {hasMore && <Text color={colors.primary}> {figures.arrowDown}</Text>}
          </>
        )}
        {stdout && (
          <>
            <Text color={colors.textDim} dimColor>
              {" "}
              •{" "}
            </Text>
            <Text color={colors.success} dimColor>
              stdout: {stdoutLines.length}
            </Text>
          </>
        )}
        {stderr && (
          <>
            <Text color={colors.textDim} dimColor>
              {" "}
              •{" "}
            </Text>
            <Text color={colors.error} dimColor>
              stderr: {stderrLines.length}
            </Text>
          </>
        )}
        {copyStatus && (
          <>
            <Text color={colors.textDim} dimColor>
              {" "}
              •{" "}
            </Text>
            <Text color={colors.success} bold>
              {copyStatus}
            </Text>
          </>
        )}
      </Box>

      {/* Help bar */}
      <NavigationTips tips={getNavigationTips()} />
    </>
  );
};

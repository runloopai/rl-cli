/**
 * StreamingLogsViewer - Live streaming logs viewer with auto-refresh
 * Polls for new logs periodically and auto-scrolls when at bottom
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
import { parseAnyLogEntry, type AnyLog } from "../utils/logFormatter.js";
import { getDevboxLogs } from "../services/devboxService.js";

interface StreamingLogsViewerProps {
  devboxId: string;
  breadcrumbItems?: Array<{ label: string; active?: boolean }>;
  onBack: () => void;
}

export const StreamingLogsViewer = ({
  devboxId,
  breadcrumbItems = [{ label: "Logs", active: true }],
  onBack,
}: StreamingLogsViewerProps) => {
  const [logs, setLogs] = React.useState<AnyLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [logsWrapMode, setLogsWrapMode] = React.useState(false);
  const [logsScroll, setLogsScroll] = React.useState(0);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [isPolling, setIsPolling] = React.useState(true);

  // Refs for cleanup
  const pollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Calculate viewport
  const logsViewport = useViewportHeight({ overhead: 10, minHeight: 10 });

  // Handle Ctrl+C
  useExitOnCtrlC();

  // Fetch logs function
  const fetchLogs = React.useCallback(async () => {
    try {
      const newLogs = await getDevboxLogs(devboxId);
      setLogs(newLogs);
      setError(null);
      if (loading) setLoading(false);
    } catch (err) {
      setError((err as Error).message);
      if (loading) setLoading(false);
    }
  }, [devboxId, loading]);

  // Start polling on mount
  React.useEffect(() => {
    // Initial fetch
    fetchLogs();

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(() => {
      if (isPolling) {
        fetchLogs();
      }
    }, 2000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchLogs, isPolling]);

  // Calculate max scroll position
  const getMaxScroll = () => {
    if (logsWrapMode) {
      return Math.max(0, logs.length - 1);
    } else {
      return Math.max(0, logs.length - logsViewport.viewportHeight);
    }
  };

  // Auto-scroll effect
  React.useEffect(() => {
    if (autoScroll && logs.length > 0) {
      const maxScroll = getMaxScroll();
      setLogsScroll(maxScroll);
    }
  }, [logs.length, autoScroll, logsViewport.viewportHeight]);

  // Handle input
  useInput((input, key) => {
    const maxScroll = getMaxScroll();

    if (key.upArrow || input === "k") {
      setLogsScroll(Math.max(0, logsScroll - 1));
      setAutoScroll(false);
    } else if (key.downArrow || input === "j") {
      const newScroll = Math.min(maxScroll, logsScroll + 1);
      setLogsScroll(newScroll);
      // Re-enable auto-scroll if we scroll to bottom
      if (newScroll >= maxScroll) {
        setAutoScroll(true);
      }
    } else if (key.pageUp) {
      setLogsScroll(Math.max(0, logsScroll - 10));
      setAutoScroll(false);
    } else if (key.pageDown) {
      const newScroll = Math.min(maxScroll, logsScroll + 10);
      setLogsScroll(newScroll);
      if (newScroll >= maxScroll) {
        setAutoScroll(true);
      }
    } else if (input === "g") {
      setLogsScroll(0);
      setAutoScroll(false);
    } else if (input === "G") {
      setLogsScroll(maxScroll);
      setAutoScroll(true);
    } else if (input === "w") {
      setLogsWrapMode(!logsWrapMode);
    } else if (input === "p") {
      // Toggle polling
      setIsPolling(!isPolling);
    } else if (input === "c" && !key.ctrl) {
      // Copy logs to clipboard (ignore if Ctrl+C for quit)
      const logsText = logs
        .map((log: AnyLog) => {
          const parts = parseAnyLogEntry(log);
          const cmd = parts.cmd ? `$ ${parts.cmd} ` : "";
          const exitCode =
            parts.exitCode !== null ? `exit=${parts.exitCode} ` : "";
          const shell = parts.shellName ? `(${parts.shellName}) ` : "";
          return `${parts.timestamp} ${parts.level} [${parts.source}] ${shell}${cmd}${parts.message} ${exitCode}`.trim();
        })
        .join("\n");

      const copyToClipboard = async (text: string) => {
        const { spawn } = await import("child_process");
        const platform = process.platform;

        let command: string;
        let args: string[];

        if (platform === "darwin") {
          command = "pbcopy";
          args = [];
        } else if (platform === "win32") {
          command = "clip";
          args = [];
        } else {
          command = "xclip";
          args = ["-selection", "clipboard"];
        }

        const proc = spawn(command, args);
        proc.stdin.write(text);
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

      copyToClipboard(logsText);
    } else if (input === "q" || key.escape || key.return) {
      onBack();
    }
  });

  const viewportHeight = Math.max(1, logsViewport.viewportHeight);
  const terminalWidth = logsViewport.terminalWidth;
  const boxChrome = 8;
  const contentWidth = Math.max(40, terminalWidth - boxChrome);

  // Helper to sanitize log message
  const sanitizeMessage = (message: string): string => {
    const strippedAnsi = message.replace(
      // eslint-disable-next-line no-control-regex
      /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
      "",
    );
    return (
      strippedAnsi
        .replace(/\r\n/g, " ")
        .replace(/\n/g, " ")
        .replace(/\r/g, " ")
        .replace(/\t/g, " ")
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1F]/g, "")
    );
  };

  // Calculate visible logs
  let visibleLogs: AnyLog[];
  let actualScroll: number;

  if (logsWrapMode) {
    actualScroll = Math.min(logsScroll, Math.max(0, logs.length - 1));
    visibleLogs = [];
    let lineCount = 0;

    for (let i = actualScroll; i < logs.length; i++) {
      const parts = parseAnyLogEntry(logs[i]);
      const sanitized = sanitizeMessage(parts.message);
      const totalLength = parts.timestamp.length + parts.level.length + parts.source.length + sanitized.length + 10;
      const entryLines = Math.ceil(totalLength / contentWidth);
      
      if (lineCount + entryLines > viewportHeight && visibleLogs.length > 0) {
        break;
      }
      visibleLogs.push(logs[i]);
      lineCount += entryLines;
    }
  } else {
    const maxScroll = Math.max(0, logs.length - viewportHeight);
    actualScroll = Math.min(logsScroll, maxScroll);
    visibleLogs = logs.slice(actualScroll, actualScroll + viewportHeight);
  }

  const hasMore = actualScroll + visibleLogs.length < logs.length;
  const hasLess = actualScroll > 0;

  // Color maps
  const levelColorMap: Record<string, string> = {
    red: colors.error,
    yellow: colors.warning,
    blue: colors.primary,
    gray: colors.textDim,
  };
  const sourceColorMap: Record<string, string> = {
    magenta: "#d33682",
    cyan: colors.info,
    green: colors.success,
    yellow: colors.warning,
    gray: colors.textDim,
    white: colors.text,
  };

  return (
    <>
      <Breadcrumb items={breadcrumbItems} />

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.border}
        paddingX={1}
        height={viewportHeight + 2}
      >
        {loading ? (
          <Box>
            <Text color={colors.info}>
              <Spinner type="dots" />
            </Text>
            <Text color={colors.textDim}> Loading logs...</Text>
          </Box>
        ) : error ? (
          <Text color={colors.error}>
            {figures.cross} Error: {error}
          </Text>
        ) : logs.length === 0 ? (
          <Box>
            {isPolling && (
              <Text color={colors.info}>
                <Spinner type="dots" />{" "}
              </Text>
            )}
            <Text color={colors.textDim}>
              Waiting for logs...
            </Text>
          </Box>
        ) : (
          visibleLogs.map((log: AnyLog, index: number) => {
            const parts = parseAnyLogEntry(log);
            const sanitizedMessage = sanitizeMessage(parts.message);
            const MAX_MESSAGE_LENGTH = 1000;
            const fullMessage =
              sanitizedMessage.length > MAX_MESSAGE_LENGTH
                ? sanitizedMessage.substring(0, MAX_MESSAGE_LENGTH) + "..."
                : sanitizedMessage;

            const cmd = parts.cmd
              ? `$ ${parts.cmd.substring(0, 40)}${parts.cmd.length > 40 ? "..." : ""} `
              : "";
            const exitCode =
              parts.exitCode !== null ? `exit=${parts.exitCode} ` : "";

            const levelColor = levelColorMap[parts.levelColor] || colors.textDim;
            const sourceColor = sourceColorMap[parts.sourceColor] || colors.textDim;

            if (logsWrapMode) {
              return (
                <Box key={index} width={contentWidth} flexDirection="column">
                  <Text wrap="wrap">
                    <Text color={colors.textDim} dimColor>
                      {parts.timestamp}
                    </Text>
                    <Text> </Text>
                    <Text color={levelColor} bold={parts.levelColor === "red"}>
                      {parts.level}
                    </Text>
                    <Text> </Text>
                    <Text color={sourceColor}>[{parts.source}]</Text>
                    <Text> </Text>
                    {parts.shellName && (
                      <Text color={colors.textDim} dimColor>
                        ({parts.shellName}){" "}
                      </Text>
                    )}
                    {cmd && <Text color={colors.info}>{cmd}</Text>}
                    <Text>{fullMessage}</Text>
                    {exitCode && (
                      <Text
                        color={parts.exitCode === 0 ? colors.success : colors.error}
                      >
                        {" "}
                        {exitCode}
                      </Text>
                    )}
                  </Text>
                </Box>
              );
            } else {
              const shellPart = parts.shellName ? `(${parts.shellName}) ` : "";
              const exitPart = exitCode ? ` ${exitCode}` : "";
              const prefix = `${parts.timestamp} ${parts.level} [${parts.source}] ${shellPart}${cmd}`;
              const suffix = exitPart;
              const availableForMessage = contentWidth - prefix.length - suffix.length;

              let displayMessage: string;
              if (availableForMessage <= 3) {
                displayMessage = "";
              } else if (fullMessage.length <= availableForMessage) {
                displayMessage = fullMessage;
              } else {
                displayMessage = fullMessage.substring(0, availableForMessage - 3) + "...";
              }

              return (
                <Box key={index} width={contentWidth}>
                  <Text wrap="truncate-end">
                    <Text color={colors.textDim} dimColor>
                      {parts.timestamp}
                    </Text>
                    <Text> </Text>
                    <Text color={levelColor} bold={parts.levelColor === "red"}>
                      {parts.level}
                    </Text>
                    <Text> </Text>
                    <Text color={sourceColor}>[{parts.source}]</Text>
                    <Text> </Text>
                    {parts.shellName && (
                      <Text color={colors.textDim} dimColor>
                        ({parts.shellName}){" "}
                      </Text>
                    )}
                    {cmd && <Text color={colors.info}>{cmd}</Text>}
                    <Text>{displayMessage}</Text>
                    {exitCode && (
                      <Text
                        color={parts.exitCode === 0 ? colors.success : colors.error}
                      >
                        {" "}
                        {exitCode}
                      </Text>
                    )}
                  </Text>
                </Box>
              );
            }
          })
        )}
      </Box>

      {/* Statistics bar */}
      <Box marginTop={1} paddingX={1}>
        <Text color={colors.primary} bold>
          {figures.hamburger} {logs.length}
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}logs
        </Text>
        {logs.length > 0 && (
          <>
            <Text color={colors.textDim} dimColor>
              {" "}•{" "}
            </Text>
            <Text color={colors.textDim} dimColor>
              {actualScroll + 1}-{Math.min(actualScroll + visibleLogs.length, logs.length)} of {logs.length}
            </Text>
            {hasLess && <Text color={colors.primary}> {figures.arrowUp}</Text>}
            {hasMore && <Text color={colors.primary}> {figures.arrowDown}</Text>}
          </>
        )}
        <Text color={colors.textDim} dimColor>
          {" "}•{" "}
        </Text>
        {isPolling ? (
          <>
            <Text color={colors.success}>
              <Spinner type="dots" />
            </Text>
            <Text color={colors.success}> Live</Text>
          </>
        ) : (
          <Text color={colors.textDim}>Paused</Text>
        )}
        <Text color={colors.textDim} dimColor>
          {" "}•{" "}
        </Text>
        <Text
          color={logsWrapMode ? colors.success : colors.textDim}
          bold={logsWrapMode}
        >
          {logsWrapMode ? "Wrap: ON" : "Wrap: OFF"}
        </Text>
        {copyStatus && (
          <>
            <Text color={colors.textDim} dimColor>
              {" "}•{" "}
            </Text>
            <Text color={colors.success} bold>
              {copyStatus}
            </Text>
          </>
        )}
      </Box>

      <NavigationTips
        showArrows
        tips={[
          { key: "g/G", label: "Top/Bottom" },
          { key: "p", label: isPolling ? "Pause" : "Resume" },
          { key: "w", label: "Wrap" },
          { key: "c", label: "Copy" },
          { key: "q/esc", label: "Back" },
        ]}
      />
    </>
  );
};

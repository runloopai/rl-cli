/**
 * LogsViewer - Shared component for viewing logs (devbox or blueprint)
 * Extracted from DevboxActionsMenu for reuse
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { colors } from "../utils/theme.js";
import { copyToClipboard } from "../utils/clipboard.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { parseAnyLogEntry, type AnyLog } from "../utils/logFormatter.js";

interface LogsViewerProps {
  logs: AnyLog[];
  breadcrumbItems?: Array<{ label: string; active?: boolean }>;
  onBack: () => void;
  title?: string;
}

export const LogsViewer = ({
  logs,
  breadcrumbItems = [{ label: "Logs", active: true }],
  onBack,
  title: _title = "Logs",
}: LogsViewerProps) => {
  const [logsWrapMode, setLogsWrapMode] = React.useState(false);
  const [logsScroll, setLogsScroll] = React.useState(0);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Calculate viewport for logs output:
  // - Breadcrumb (border top + content + border bottom + marginBottom): 4 lines
  // - Log box borders: 2 lines (added to height by Ink)
  // - Stats bar (marginTop + content): 2 lines
  // - Help bar (content): 1 line
  // Total: 9 lines
  const logsViewport = useViewportHeight({ overhead: 9, minHeight: 10 });

  // Calculate max scroll position based on current mode
  // For wrap mode, we can scroll until the last entry is at the top
  // For non-wrap mode, we stop when the last entries fill the viewport
  const getMaxScroll = () => {
    if (logsWrapMode) {
      return Math.max(0, logs.length - 1);
    } else {
      return Math.max(0, logs.length - logsViewport.viewportHeight);
    }
  };

  // Handle input for logs navigation
  useInput((input, key) => {
    const maxScroll = getMaxScroll();

    if (key.upArrow || input === "k") {
      setLogsScroll(Math.max(0, logsScroll - 1));
    } else if (key.downArrow || input === "j") {
      setLogsScroll(Math.min(maxScroll, logsScroll + 1));
    } else if (key.pageUp) {
      setLogsScroll(Math.max(0, logsScroll - 10));
    } else if (key.pageDown) {
      setLogsScroll(Math.min(maxScroll, logsScroll + 10));
    } else if (input === "g") {
      setLogsScroll(0);
    } else if (input === "G") {
      setLogsScroll(maxScroll);
    } else if (input === "w") {
      setLogsWrapMode(!logsWrapMode);
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

      copyToClipboard(logsText).then((status) => {
        setCopyStatus(status);
        setTimeout(() => setCopyStatus(null), 2000);
      });
    } else if (input === "q" || key.escape || key.return) {
      onBack();
    }
  });

  const viewportHeight = Math.max(1, logsViewport.viewportHeight);
  const terminalWidth = logsViewport.terminalWidth;
  // Account for box borders (2 chars) and paddingX={1} (2 chars)
  // Add extra buffer (4 chars) for any edge cases with Ink rendering
  const boxChrome = 8;
  const contentWidth = Math.max(40, terminalWidth - boxChrome);

  // Helper to sanitize log message
  const sanitizeMessage = (message: string): string => {
    // Strip ANSI escape sequences (colors, cursor movement, etc.)
    const strippedAnsi = message.replace(
      /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g,
      "",
    );
    // Replace control characters with spaces
    return (
      strippedAnsi
        .replace(/\r\n/g, " ")
        .replace(/\n/g, " ")
        .replace(/\r/g, " ")
        .replace(/\t/g, " ")
        // Remove any other control characters (ASCII 0-31 except space)

        .replace(/[\x00-\x1F]/g, "")
    );
  };

  // Helper to calculate how many lines a log entry will take when wrapped
  const calculateWrappedLineCount = (log: AnyLog): number => {
    const parts = parseAnyLogEntry(log);
    const sanitized = sanitizeMessage(parts.message);
    const MAX_MESSAGE_LENGTH = 1000;
    const fullMessage =
      sanitized.length > MAX_MESSAGE_LENGTH
        ? sanitized.substring(0, MAX_MESSAGE_LENGTH) + "..."
        : sanitized;

    const cmd = parts.cmd
      ? `$ ${parts.cmd.substring(0, 40)}${parts.cmd.length > 40 ? "..." : ""} `
      : "";
    const exitCode = parts.exitCode !== null ? `exit=${parts.exitCode} ` : "";
    const shellPart = parts.shellName ? `(${parts.shellName}) ` : "";

    // Calculate total line length
    const totalLength =
      parts.timestamp.length +
      1 + // space
      parts.level.length +
      1 + // space
      parts.source.length +
      2 + // brackets
      1 + // space
      shellPart.length +
      cmd.length +
      fullMessage.length +
      (exitCode ? 1 + exitCode.length : 0);

    // Calculate how many lines this will wrap to
    // Use contentWidth directly since we now have proper width constraints
    const lineCount = Math.ceil(totalLength / contentWidth);
    return Math.max(1, lineCount);
  };

  // Calculate visible logs based on wrap mode
  let visibleLogs: AnyLog[];
  let actualScroll: number;
  let visibleLineCount: number;

  if (logsWrapMode) {
    // In wrap mode, we need to count lines and only show what fits
    actualScroll = Math.min(logsScroll, Math.max(0, logs.length - 1));
    visibleLogs = [];
    visibleLineCount = 0;

    for (let i = actualScroll; i < logs.length; i++) {
      const lineCount = calculateWrappedLineCount(logs[i]);
      if (
        visibleLineCount + lineCount > viewportHeight &&
        visibleLogs.length > 0
      ) {
        break;
      }
      visibleLogs.push(logs[i]);
      visibleLineCount += lineCount;
    }
  } else {
    // In non-wrap mode, each log is exactly 1 line
    const maxScroll = Math.max(0, logs.length - viewportHeight);
    actualScroll = Math.min(logsScroll, maxScroll);
    visibleLogs = logs.slice(actualScroll, actualScroll + viewportHeight);
    visibleLineCount = visibleLogs.length;
  }

  const hasMore = actualScroll + visibleLogs.length < logs.length;
  const hasLess = actualScroll > 0;

  // Color maps (defined once outside the loop)
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
        height={viewportHeight}
      >
        {logs.length === 0 ? (
          <Text color={colors.textDim} dimColor>
            No logs available
          </Text>
        ) : (
          visibleLogs.map((log: AnyLog, index: number) => {
            const parts = parseAnyLogEntry(log);
            const sanitizedMessage = sanitizeMessage(parts.message);

            // Limit message length to prevent Yoga layout engine errors
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

            const levelColor =
              levelColorMap[parts.levelColor] || colors.textDim;
            const sourceColor =
              sourceColorMap[parts.sourceColor] || colors.textDim;

            if (logsWrapMode) {
              // For wrap mode, render with explicit width to prevent layout issues
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
                        color={
                          parts.exitCode === 0 ? colors.success : colors.error
                        }
                      >
                        {" "}
                        {exitCode}
                      </Text>
                    )}
                  </Text>
                </Box>
              );
            } else {
              // Non-wrap mode: build the complete line and truncate to fit exactly
              const shellPart = parts.shellName ? `(${parts.shellName}) ` : "";
              const exitPart = exitCode ? ` ${exitCode}` : "";

              // Build the full line content
              const prefix = `${parts.timestamp} ${parts.level} [${parts.source}] ${shellPart}${cmd}`;
              const suffix = exitPart;

              // Calculate how much space is available for the message
              const availableForMessage =
                contentWidth - prefix.length - suffix.length;

              let displayMessage: string;
              if (availableForMessage <= 3) {
                // No room for message
                displayMessage = "";
              } else if (fullMessage.length <= availableForMessage) {
                displayMessage = fullMessage;
              } else {
                displayMessage =
                  fullMessage.substring(0, availableForMessage - 3) + "...";
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
                        color={
                          parts.exitCode === 0 ? colors.success : colors.error
                        }
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

      <Box marginTop={1} paddingX={1}>
        <Text color={colors.primary} bold>
          {figures.hamburger} {logs.length}
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          total logs
        </Text>
        <Text color={colors.textDim} dimColor>
          {" "}
          •{" "}
        </Text>
        <Text color={colors.textDim} dimColor>
          Viewing {actualScroll + 1}-
          {Math.min(actualScroll + visibleLogs.length, logs.length)} of{" "}
          {logs.length}
        </Text>
        {hasLess && <Text color={colors.primary}> {figures.arrowUp}</Text>}
        {hasMore && <Text color={colors.primary}> {figures.arrowDown}</Text>}
        <Text color={colors.textDim} dimColor>
          {" "}
          •{" "}
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
              {" "}
              •{" "}
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
          { key: "g", label: "Top" },
          { key: "G", label: "Bottom" },
          { key: "w", label: "Toggle Wrap" },
          { key: "c", label: "Copy" },
          { key: "Enter/q/esc", label: "Back" },
        ]}
      />
    </>
  );
};

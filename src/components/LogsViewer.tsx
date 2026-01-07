/**
 * LogsViewer - Shared component for viewing logs (devbox or blueprint)
 * Extracted from DevboxActionsMenu for reuse
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { Breadcrumb } from "./Breadcrumb.js";
import { colors } from "../utils/theme.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
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
  title = "Logs",
}: LogsViewerProps) => {
  const [logsWrapMode, setLogsWrapMode] = React.useState(false);
  const [logsScroll, setLogsScroll] = React.useState(0);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);

  // Calculate viewport for logs output:
  // - Breadcrumb (3 lines + marginBottom): 4 lines
  // - Log box borders: 2 lines
  // - Stats bar (marginTop + content): 2 lines
  // - Help bar (marginTop + content): 2 lines
  // - Safety buffer: 1 line
  // Total: 11 lines
  const logsViewport = useViewportHeight({ overhead: 11, minHeight: 10 });

  // Handle input for logs navigation
  useInput((input, key) => {
    if (key.upArrow || input === "k") {
      setLogsScroll(Math.max(0, logsScroll - 1));
    } else if (key.downArrow || input === "j") {
      setLogsScroll(logsScroll + 1);
    } else if (key.pageUp) {
      setLogsScroll(Math.max(0, logsScroll - 10));
    } else if (key.pageDown) {
      setLogsScroll(logsScroll + 10);
    } else if (input === "g") {
      setLogsScroll(0);
    } else if (input === "G") {
      const maxScroll = Math.max(0, logs.length - logsViewport.viewportHeight);
      setLogsScroll(maxScroll);
    } else if (input === "w") {
      setLogsWrapMode(!logsWrapMode);
    } else if (input === "c") {
      // Copy logs to clipboard using shared formatter
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
            setCopyStatus("Copied to clipboard!");
            setTimeout(() => setCopyStatus(null), 2000);
          } else {
            setCopyStatus("Failed to copy");
            setTimeout(() => setCopyStatus(null), 2000);
          }
        });

        proc.on("error", () => {
          setCopyStatus("Copy not supported");
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
  const maxScroll = Math.max(0, logs.length - viewportHeight);
  const actualScroll = Math.min(logsScroll, maxScroll);
  const visibleLogs = logs.slice(actualScroll, actualScroll + viewportHeight);
  const hasMore = actualScroll + viewportHeight < logs.length;
  const hasLess = actualScroll > 0;

  return (
    <>
      <Breadcrumb items={breadcrumbItems} />

      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.border}
        paddingX={1}
      >
        {logs.length === 0 ? (
          <Text color={colors.textDim} dimColor>
            No logs available
          </Text>
        ) : (
          visibleLogs.map((log: AnyLog, index: number) => {
            const parts = parseAnyLogEntry(log);

            // Sanitize message: escape special chars to prevent layout breaks
            const escapedMessage = parts.message
              .replace(/\r\n/g, "\\n")
              .replace(/\n/g, "\\n")
              .replace(/\r/g, "\\r")
              .replace(/\t/g, "\\t");

            // Limit message length to prevent Yoga layout engine errors
            const MAX_MESSAGE_LENGTH = 1000;
            const fullMessage =
              escapedMessage.length > MAX_MESSAGE_LENGTH
                ? escapedMessage.substring(0, MAX_MESSAGE_LENGTH) + "..."
                : escapedMessage;

            const cmd = parts.cmd
              ? `$ ${parts.cmd.substring(0, 40)}${parts.cmd.length > 40 ? "..." : ""} `
              : "";
            const exitCode =
              parts.exitCode !== null ? `exit=${parts.exitCode} ` : "";

            // Map color names to theme colors
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
            const levelColor =
              levelColorMap[parts.levelColor] || colors.textDim;
            const sourceColor =
              sourceColorMap[parts.sourceColor] || colors.textDim;

            if (logsWrapMode) {
              return (
                <Box key={index}>
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
                </Box>
              );
            } else {
              // Calculate available width for message truncation
              const timestampLen = parts.timestamp.length;
              const levelLen = parts.level.length;
              const sourceLen = parts.source.length + 2; // brackets
              const shellLen = parts.shellName ? parts.shellName.length + 3 : 0;
              const cmdLen = cmd.length;
              const exitLen = exitCode.length;
              const spacesLen = 5; // spaces between elements
              const metadataWidth =
                timestampLen +
                levelLen +
                sourceLen +
                shellLen +
                cmdLen +
                exitLen +
                spacesLen;

              const safeTerminalWidth = Math.max(80, terminalWidth);
              const availableMessageWidth = Math.max(
                20,
                safeTerminalWidth - metadataWidth,
              );
              const truncatedMessage =
                fullMessage.length > availableMessageWidth
                  ? fullMessage.substring(
                      0,
                      Math.max(1, availableMessageWidth - 3),
                    ) + "..."
                  : fullMessage;

              return (
                <Box key={index}>
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
                  <Text>{truncatedMessage}</Text>
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
          {Math.min(actualScroll + viewportHeight, logs.length)} of{" "}
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

      <Box marginTop={1} paddingX={1}>
        <Text color={colors.textDim} dimColor>
          {figures.arrowUp}
          {figures.arrowDown} Navigate • [g] Top • [G] Bottom • [w] Toggle Wrap
          • [c] Copy • [Enter], [q], or [esc] Back
        </Text>
      </Box>
    </>
  );
};

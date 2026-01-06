/**
 * Shared log formatting utilities for both CLI and interactive mode
 */

import chalk from "chalk";
import type { DevboxLogsListView } from "@runloop/api-client/resources/devboxes/logs";

export type DevboxLog = DevboxLogsListView["logs"][number];

// Source abbreviations for consistent display
const SOURCE_CONFIG: Record<string, { abbrev: string; color: string }> = {
  setup_commands: { abbrev: "setup", color: "magenta" },
  entrypoint: { abbrev: "entry", color: "cyan" },
  exec: { abbrev: "exec", color: "green" },
  files: { abbrev: "files", color: "yellow" },
  stats: { abbrev: "stats", color: "gray" },
};

const SOURCE_WIDTH = 5;

export interface FormattedLogParts {
  timestamp: string;
  level: string;
  levelColor: string;
  source: string;
  sourceColor: string;
  shellName: string | null;
  cmd: string | null;
  message: string;
  exitCode: number | null;
  exitCodeColor: string;
}

/**
 * Format timestamp based on how recent the log is
 */
export function formatTimestamp(timestampMs: number): string {
  const date = new Date(timestampMs);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const isThisYear = date.getFullYear() === now.getFullYear();

  const time = date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const ms = date.getMilliseconds().toString().padStart(3, "0");

  if (isToday) {
    return `${time}.${ms}`;
  } else if (isThisYear) {
    const monthDay = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${monthDay} ${time}`;
  } else {
    const fullDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return `${fullDate} ${time}`;
  }
}

/**
 * Get log level info (normalized name and color)
 */
export function getLogLevelInfo(level: string): { name: string; color: string } {
  const normalized = level.toUpperCase();
  switch (normalized) {
    case "ERROR":
    case "ERR":
      return { name: "ERROR", color: "red" };
    case "WARN":
    case "WARNING":
      return { name: "WARN ", color: "yellow" };
    case "INFO":
      return { name: "INFO ", color: "blue" };
    case "DEBUG":
      return { name: "DEBUG", color: "gray" };
    default:
      return { name: normalized.padEnd(5), color: "gray" };
  }
}

/**
 * Get source info (abbreviated name and color)
 */
export function getSourceInfo(source: string | null | undefined): { abbrev: string; color: string } {
  if (!source) {
    return { abbrev: "sys".padEnd(SOURCE_WIDTH), color: "gray" };
  }

  const config = SOURCE_CONFIG[source];
  if (config) {
    return { abbrev: config.abbrev.padEnd(SOURCE_WIDTH), color: config.color };
  }

  // Unknown source: truncate/pad to width
  const abbrev = source.length > SOURCE_WIDTH 
    ? source.slice(0, SOURCE_WIDTH) 
    : source.padEnd(SOURCE_WIDTH);
  return { abbrev, color: "white" };
}

/**
 * Parse a log entry into formatted parts (for use in Ink UI)
 */
export function parseLogEntry(log: DevboxLog): FormattedLogParts {
  const levelInfo = getLogLevelInfo(log.level);
  const sourceInfo = getSourceInfo(log.source as string);

  return {
    timestamp: formatTimestamp(log.timestamp_ms),
    level: levelInfo.name,
    levelColor: levelInfo.color,
    source: sourceInfo.abbrev,
    sourceColor: sourceInfo.color,
    shellName: log.shell_name || null,
    cmd: log.cmd || null,
    message: log.message || "",
    exitCode: log.exit_code ?? null,
    exitCodeColor: log.exit_code === 0 ? "green" : "red",
  };
}

/**
 * Format a log entry as a string with chalk colors (for CLI output)
 */
export function formatLogEntryString(log: DevboxLog): string {
  const parts = parseLogEntry(log);
  const result: string[] = [];

  // Timestamp (dim)
  result.push(chalk.dim(parts.timestamp));

  // Level (colored, bold for errors)
  const levelChalk = parts.levelColor === "red" 
    ? chalk.red.bold 
    : parts.levelColor === "yellow"
    ? chalk.yellow.bold
    : parts.levelColor === "blue"
    ? chalk.blue
    : chalk.gray;
  result.push(levelChalk(parts.level));

  // Source (colored, in brackets)
  const sourceChalk = {
    magenta: chalk.magenta,
    cyan: chalk.cyan,
    green: chalk.green,
    yellow: chalk.yellow,
    gray: chalk.gray,
    white: chalk.white,
  }[parts.sourceColor] || chalk.white;
  result.push(sourceChalk(`[${parts.source}]`));

  // Shell name if present
  if (parts.shellName) {
    result.push(chalk.dim(`(${parts.shellName})`));
  }

  // Command if present
  if (parts.cmd) {
    result.push(chalk.cyan("$") + " " + chalk.white(parts.cmd));
  }

  // Message
  if (parts.message) {
    result.push(parts.message);
  }

  // Exit code if present
  if (parts.exitCode !== null) {
    const exitChalk = parts.exitCode === 0 ? chalk.green : chalk.red;
    result.push(exitChalk(`exit=${parts.exitCode}`));
  }

  return result.join(" ");
}

/**
 * Format logs for CLI output
 */
export function formatLogsForCLI(response: DevboxLogsListView): void {
  const logs = response.logs;

  if (!logs || logs.length === 0) {
    console.log(chalk.dim("No logs available"));
    return;
  }

  for (const log of logs) {
    console.log(formatLogEntryString(log));
  }
}


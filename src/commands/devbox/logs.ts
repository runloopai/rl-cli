/**
 * Get devbox logs command
 */

import chalk from "chalk";
import type { DevboxLogsListView } from "@runloop/api-client/resources/devboxes/logs";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

type DevboxLog = DevboxLogsListView["logs"][number];

interface LogsOptions {
  output?: string;
}

function formatLogLevel(level: string): string {
  const normalized = level.toUpperCase();
  switch (normalized) {
    case "ERROR":
    case "ERR":
      return chalk.red.bold("ERROR");
    case "WARN":
    case "WARNING":
      return chalk.yellow.bold("WARN ");
    case "INFO":
      return chalk.blue("INFO ");
    case "DEBUG":
      return chalk.gray("DEBUG");
    default:
      return chalk.gray(normalized.padEnd(5));
  }
}

function formatSource(source: string | null | undefined): string {
  if (!source) return chalk.dim("[system]");

  const colors: Record<string, (s: string) => string> = {
    setup_commands: chalk.magenta,
    entrypoint: chalk.cyan,
    exec: chalk.green,
    files: chalk.yellow,
    stats: chalk.gray,
  };
  const colorFn = colors[source] || chalk.white;
  return colorFn(`[${source}]`);
}

function formatTimestamp(timestampMs: number): string {
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
    // Today: show time with milliseconds for fine granularity
    return chalk.dim(`${time}.${ms}`);
  } else if (isThisYear) {
    // This year: show "Jan 5 15:44:03"
    const monthDay = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return chalk.dim(`${monthDay} ${time}`);
  } else {
    // Older: show "Jan 5, 2024 15:44:03"
    const fullDate = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return chalk.dim(`${fullDate} ${time}`);
  }
}

function formatLogEntry(log: DevboxLog): string {
  const parts: string[] = [];

  // Timestamp
  parts.push(formatTimestamp(log.timestamp_ms));

  // Level
  parts.push(formatLogLevel(log.level));

  // Source
  parts.push(formatSource(log.source as string));

  // Shell name if present
  if (log.shell_name) {
    parts.push(chalk.dim(`(${log.shell_name})`));
  }

  // Command if present
  if (log.cmd) {
    parts.push(chalk.cyan("$") + " " + chalk.white(log.cmd));
  }

  // Message if present
  if (log.message) {
    parts.push(log.message);
  }

  // Exit code if present
  if (log.exit_code !== undefined && log.exit_code !== null) {
    const exitColor = log.exit_code === 0 ? chalk.green : chalk.red;
    parts.push(exitColor(`exit=${log.exit_code}`));
  }

  return parts.join(" ");
}

function formatLogs(response: DevboxLogsListView): void {
  const logs = response.logs;

  if (!logs || logs.length === 0) {
    console.log(chalk.dim("No logs available"));
    return;
  }

  for (const log of logs) {
    console.log(formatLogEntry(log));
  }
}

export async function getLogs(devboxId: string, options: LogsOptions = {}) {
  try {
    const client = getClient();
    const logs = await client.devboxes.logs.list(devboxId);

    // Pretty print for text output, JSON for others
    if (!options.output || options.output === "text") {
      formatLogs(logs);
    } else {
      output(logs, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to get devbox logs", error);
  }
}

/**
 * Get blueprint build logs command
 */

import chalk from "chalk";
import type {
  BlueprintBuildLogsListView,
  BlueprintBuildLog,
} from "@runloop/api-client/resources/blueprints";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface BlueprintLogsOptions {
  id: string;
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

function colorizeMessage(message: string): string {
  // Colorize common Docker build patterns
  if (message.startsWith("Step ") || message.startsWith("---> ")) {
    return chalk.cyan.bold(message);
  }
  if (message.startsWith("Successfully")) {
    return chalk.green.bold(message);
  }
  if (message.startsWith("Removing intermediate container")) {
    return chalk.dim(message);
  }
  if (
    message.toLowerCase().includes("error") ||
    message.toLowerCase().includes("failed")
  ) {
    return chalk.red(message);
  }
  if (message.toLowerCase().includes("warning")) {
    return chalk.yellow(message);
  }
  // Dockerfile instructions
  if (
    message.startsWith("RUN ") ||
    message.startsWith("COPY ") ||
    message.startsWith("ADD ") ||
    message.startsWith("FROM ") ||
    message.startsWith("WORKDIR ") ||
    message.startsWith("ENV ")
  ) {
    return chalk.yellow(message);
  }
  return message;
}

function formatLogEntry(log: BlueprintBuildLog): string {
  const parts: string[] = [];

  // Timestamp
  parts.push(formatTimestamp(log.timestamp_ms));

  // Level
  parts.push(formatLogLevel(log.level));

  // Message with colorization
  parts.push(colorizeMessage(log.message));

  return parts.join(" ");
}

function formatLogs(response: BlueprintBuildLogsListView): void {
  const logs = response.logs;

  if (!logs || logs.length === 0) {
    console.log(chalk.dim("No build logs available"));
    return;
  }

  for (const log of logs) {
    console.log(formatLogEntry(log));
  }
}

export async function getBlueprintLogs(options: BlueprintLogsOptions) {
  try {
    const client = getClient();

    let blueprintId = options.id;

    // Check if it's an ID (starts with bpt_) or a name
    if (!options.id.startsWith("bpt_")) {
      // It's a name, search for it
      const result = await client.blueprints.list({ name: options.id });
      const blueprints = result.blueprints || [];

      if (blueprints.length === 0) {
        outputError(`Blueprint not found: ${options.id}`);
        return;
      }

      // Use the first exact match, or first result if no exact match
      const blueprint =
        blueprints.find((b) => b.name === options.id) || blueprints[0];
      blueprintId = blueprint.id;
    }

    const logs = await client.blueprints.logs(blueprintId);

    // Pretty print for text output, JSON for others
    if (!options.output || options.output === "text") {
      formatLogs(logs);
    } else {
      output(logs, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to get blueprint logs", error);
  }
}

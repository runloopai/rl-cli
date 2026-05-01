/**
 * List axon events command
 */

import chalk from "chalk";
import {
  listAxonEvents as listAxonEventsService,
  type AxonEvent,
} from "../../services/axonService.js";
import { output, outputError, parseLimit } from "../../utils/output.js";

interface EventsOptions {
  limit?: string;
  output?: string;
}

function printTable(events: AxonEvent[], hasMore: boolean): void {
  if (events.length === 0) {
    console.log(chalk.dim("No events found"));
    return;
  }

  const COL_SEQUENCE = 10;
  const COL_TIMESTAMP = 24;
  const COL_ORIGIN = 12;
  const COL_SOURCE = 16;
  const COL_EVENT_TYPE = 20;

  const header =
    "SEQUENCE".padEnd(COL_SEQUENCE) +
    " " +
    "TIMESTAMP".padEnd(COL_TIMESTAMP) +
    " " +
    "ORIGIN".padEnd(COL_ORIGIN) +
    " " +
    "SOURCE".padEnd(COL_SOURCE) +
    " " +
    "EVENT_TYPE".padEnd(COL_EVENT_TYPE) +
    " " +
    "PAYLOAD";
  console.log(chalk.bold(header));
  console.log(chalk.dim("─".repeat(header.length)));

  for (const event of events) {
    const sequence = String(event.sequence).padEnd(COL_SEQUENCE);
    const timestamp = new Date(event.timestamp_ms)
      .toISOString()
      .padEnd(COL_TIMESTAMP);
    const origin =
      event.origin.length > COL_ORIGIN
        ? event.origin.slice(0, COL_ORIGIN - 1) + "…"
        : event.origin.padEnd(COL_ORIGIN);
    const source =
      event.source.length > COL_SOURCE
        ? event.source.slice(0, COL_SOURCE - 1) + "…"
        : event.source.padEnd(COL_SOURCE);
    const eventType =
      event.event_type.length > COL_EVENT_TYPE
        ? event.event_type.slice(0, COL_EVENT_TYPE - 1) + "…"
        : event.event_type.padEnd(COL_EVENT_TYPE);
    const payload =
      event.payload.length > 60
        ? event.payload.slice(0, 59) + "…"
        : event.payload;

    console.log(
      `${sequence} ${timestamp} ${origin} ${source} ${eventType} ${payload}`,
    );
  }

  console.log();
  console.log(
    chalk.dim(`${events.length} event${events.length !== 1 ? "s" : ""}`),
  );

  if (hasMore) {
    console.log(
      chalk.dim("More events available; increase --limit to fetch more."),
    );
  }
}

export async function listAxonEventsCommand(
  axonId: string,
  options: EventsOptions,
): Promise<void> {
  try {
    const parsed = parseLimit(options.limit);
    const limit = parsed === Infinity ? 50 : parsed;
    const result = await listAxonEventsService(axonId, { limit });

    if (options.output && options.output !== "text") {
      output(result.events, { format: options.output, defaultFormat: "json" });
      return;
    }

    printTable(result.events, result.hasMore);
  } catch (error) {
    outputError("Failed to get axon events", error);
  }
}

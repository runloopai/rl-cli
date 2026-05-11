/**
 * List axon events command
 */

import { listAxonEvents as listAxonEventsService } from "../../services/axonService.js";
import { output, outputError, parseLimit } from "../../utils/output.js";

interface EventsOptions {
  limit?: string;
  output?: string;
}

export async function listAxonEventsCommand(
  axonId: string,
  options: EventsOptions,
): Promise<void> {
  try {
    const parsed = parseLimit(options.limit);
    const limit = parsed === Infinity ? 50 : parsed;
    const result = await listAxonEventsService(axonId, { limit });

    output(result.events, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get axon events", error);
  }
}

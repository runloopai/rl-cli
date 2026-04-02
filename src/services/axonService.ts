/**
 * Axon service — active axons listing (beta API)
 */
import { getClient } from "../utils/client.js";
import type { AxonView } from "@runloop/api-client/resources/axons/axons";
import type { AxonsCursorIDPage } from "@runloop/api-client/pagination";

export type Axon = AxonView;

export interface ListActiveAxonsOptions {
  limit?: number;
  startingAfter?: string;
}

export interface ListActiveAxonsResult {
  axons: Axon[];
  hasMore: boolean;
}

/**
 * List active axons with optional cursor pagination (`limit`, `starting_after`).
 */
export async function listActiveAxons(
  options: ListActiveAxonsOptions,
): Promise<ListActiveAxonsResult> {
  const client = getClient();

  const query: {
    limit?: number;
    starting_after?: string;
  } = {};
  if (options.limit !== undefined) {
    query.limit = options.limit;
  }
  if (options.startingAfter) {
    query.starting_after = options.startingAfter;
  }

  const page = (await client.axons.list(
    Object.keys(query).length > 0 ? query : undefined,
  )) as AxonsCursorIDPage<AxonView>;

  const axons = page.axons || [];
  const hasMore = page.has_more || false;

  return { axons, hasMore };
}

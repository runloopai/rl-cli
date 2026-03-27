/**
 * Axon service — active axons listing (beta API)
 */
import { getClient } from "../utils/client.js";
import type {
  AxonListView,
  AxonView,
} from "@runloop/api-client/resources/axons/axons";

export type Axon = AxonView;

export interface ListActiveAxonsOptions {
  limit?: number;
  startingAfter?: string;
}

export interface ListActiveAxonsResult {
  axons: Axon[];
  hasMore: boolean;
}

/** Response shape once the list-active-axons endpoint supports cursor pagination */
interface AxonListPageResponse extends AxonListView {
  has_more?: boolean;
}

/**
 * List active axons with optional cursor pagination (`limit`, `starting_after`).
 */
export async function listActiveAxons(
  options: ListActiveAxonsOptions,
): Promise<ListActiveAxonsResult> {
  const client = getClient();

  const query: Record<string, string | number> = {};
  if (options.limit !== undefined) {
    query.limit = options.limit;
  }
  if (options.startingAfter) {
    query.starting_after = options.startingAfter;
  }

  const page = (await client.axons.list(
    Object.keys(query).length > 0 ? { query } : undefined,
  )) as AxonListPageResponse;

  const axons = page.axons || [];
  const hasMore = page.has_more === true;

  return { axons, hasMore };
}

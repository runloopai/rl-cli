/**
 * Axon service — axon listing and retrieval
 */
import { getClient } from "../utils/client.js";
import type { AxonView } from "@runloop/api-client/resources/axons/axons";
import type { AxonsCursorIDPage } from "@runloop/api-client/pagination";

export type Axon = AxonView;

export interface ListActiveAxonsOptions {
  limit?: number;
  startingAfter?: string;
  name?: string;
  id?: string;
  search?: string;
  includeTotalCount?: boolean;
}

export interface ListActiveAxonsResult {
  axons: Axon[];
  hasMore: boolean;
  totalCount: number;
}

/**
 * List active axons with optional cursor pagination and search.
 * Search uses smart parsing: `axn_*` prefix → ID filter, otherwise name filter.
 */
export async function listActiveAxons(
  options: ListActiveAxonsOptions,
): Promise<ListActiveAxonsResult> {
  const client = getClient();

  const query: Record<string, unknown> = {};
  if (options.limit !== undefined) {
    query.limit = options.limit;
  }
  if (options.startingAfter) {
    query.starting_after = options.startingAfter;
  }
  if (options.includeTotalCount !== undefined) {
    query.include_total_count = options.includeTotalCount;
  }

  // Smart search parsing
  if (options.search) {
    if (options.search.startsWith("axn_")) {
      query.id = options.search;
    } else {
      query.name = options.search;
    }
  }
  if (options.name) {
    query.name = options.name;
  }
  if (options.id) {
    query.id = options.id;
  }

  const page = (await client.axons.list(
    Object.keys(query).length > 0 ? query : undefined,
  )) as AxonsCursorIDPage<AxonView>;

  const axons = page.axons || [];
  const hasMore = page.has_more || false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalCount = (page as any).total_count ?? axons.length;

  return { axons, hasMore, totalCount };
}

/**
 * Get a single axon by ID.
 */
export async function getAxon(id: string): Promise<Axon> {
  const client = getClient();
  return client.axons.retrieve(id);
}

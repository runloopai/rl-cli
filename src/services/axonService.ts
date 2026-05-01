/**
 * Axon service — axon listing and retrieval
 */
import { getClient } from "../utils/client.js";
import type { AxonView } from "@runloop/api-client/resources/axons/axons";
import type { AxonsCursorIDPage } from "@runloop/api-client/pagination";
import type {
  SqlQueryResultView,
  SqlColumnMetaView,
  SqlResultMetaView,
} from "@runloop/api-client/resources/axons/sql";

export type { SqlQueryResultView, SqlColumnMetaView, SqlResultMetaView };
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

export interface AxonEvent {
  sequence: number;
  timestamp_ms: number;
  origin: string;
  source: string;
  event_type: string;
  payload: string;
}

export interface AxonEventsResult {
  events: AxonEvent[];
  hasMore: boolean;
  meta: SqlResultMetaView;
}

export async function listAxonEvents(
  axonId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<AxonEventsResult> {
  const client = getClient();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const result = await client.axons.sql.query(axonId, {
    sql: `SELECT sequence, timestamp_ms, origin, source, event_type, payload FROM rl_axon_events ORDER BY sequence DESC LIMIT ? OFFSET ?`,
    params: [limit + 1, offset],
  });
  const allRows = (result.rows as unknown[][]).map((row) => ({
    sequence: row[0] as number,
    timestamp_ms: row[1] as number,
    origin: row[2] as string,
    source: row[3] as string,
    event_type: row[4] as string,
    payload: row[5] as string,
  }));
  const hasMore = allRows.length > limit;
  const events = hasMore ? allRows.slice(0, limit) : allRows;
  return { events, hasMore, meta: result.meta };
}

export async function executeAxonSql(
  axonId: string,
  sql: string,
  params?: unknown[],
): Promise<SqlQueryResultView> {
  const client = getClient();
  return client.axons.sql.query(axonId, { sql, params });
}

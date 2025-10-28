/**
 * Blueprint Service - Handles all blueprint API calls
 */
import { getClient } from "../utils/client.js";
import type { Blueprint } from "../store/blueprintStore.js";

export interface ListBlueprintsOptions {
  limit: number;
  startingAfter?: string;
  search?: string;
}

export interface ListBlueprintsResult {
  blueprints: Blueprint[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * List blueprints with pagination
 */
export async function listBlueprints(
  options: ListBlueprintsOptions,
): Promise<ListBlueprintsResult> {
  const client = getClient();

  const queryParams: any = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }
  if (options.search) {
    queryParams.search = options.search;
  }

  const pagePromise = client.blueprints.list(queryParams);
  let page = (await pagePromise) as any;

  const blueprints: Blueprint[] = [];

  if (page.blueprints && Array.isArray(page.blueprints)) {
    page.blueprints.forEach((b: any) => {
      // CRITICAL: Truncate all strings to prevent Yoga crashes
      const MAX_ID_LENGTH = 100;
      const MAX_NAME_LENGTH = 200;
      const MAX_STATUS_LENGTH = 50;
      const MAX_ARCH_LENGTH = 50;
      const MAX_RESOURCES_LENGTH = 100;

      blueprints.push({
        id: String(b.id || "").substring(0, MAX_ID_LENGTH),
        name: String(b.name || "").substring(0, MAX_NAME_LENGTH),
        status: String(b.status || "").substring(0, MAX_STATUS_LENGTH),
        create_time_ms: b.create_time_ms,
        build_status: b.build_status
          ? String(b.build_status).substring(0, MAX_STATUS_LENGTH)
          : undefined,
        architecture: b.architecture
          ? String(b.architecture).substring(0, MAX_ARCH_LENGTH)
          : undefined,
        resources: b.resources
          ? String(b.resources).substring(0, MAX_RESOURCES_LENGTH)
          : undefined,
      });
    });
  }

  const result = {
    blueprints,
    totalCount: page.total_count || blueprints.length,
    hasMore: page.has_more || false,
  };

  page = null as any;

  return result;
}

/**
 * Get a single blueprint by ID
 */
export async function getBlueprint(id: string): Promise<Blueprint> {
  const client = getClient();
  const blueprint = await client.blueprints.retrieve(id);

  return {
    id: blueprint.id,
    name: blueprint.name,
    status: blueprint.status,
    create_time_ms: blueprint.create_time_ms,
    build_status: (blueprint as any).build_status,
    architecture: (blueprint as any).architecture,
    resources: (blueprint as any).resources,
  };
}

/**
 * Get blueprint logs
 */
export async function getBlueprintLogs(id: string): Promise<any[]> {
  const client = getClient();
  const response = await client.blueprints.logs(id);

  // CRITICAL: Truncate all strings to prevent Yoga crashes
  const MAX_MESSAGE_LENGTH = 1000;
  const MAX_LEVEL_LENGTH = 20;

  const logs: any[] = [];
  if (response.logs && Array.isArray(response.logs)) {
    response.logs.forEach((log: any) => {
      // Truncate message and escape newlines
      let message = String(log.message || "");
      if (message.length > MAX_MESSAGE_LENGTH) {
        message = message.substring(0, MAX_MESSAGE_LENGTH) + "...";
      }
      message = message
        .replace(/\r\n/g, "\\n")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");

      logs.push({
        timestamp: log.timestamp,
        message,
        level: log.level
          ? String(log.level).substring(0, MAX_LEVEL_LENGTH)
          : undefined,
      });
    });
  }

  return logs;
}

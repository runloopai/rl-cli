/**
 * Blueprint Service - Handles all blueprint API calls
 */
import { getClient } from "../utils/client.js";
import type { Blueprint } from "../store/blueprintStore.js";
import type { BlueprintListParams, BlueprintView } from "@runloop/api-client/resources/blueprints";
import type { BlueprintsCursorIDPage } from "@runloop/api-client/pagination";

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

  const queryParams: BlueprintListParams = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }
  if (options.search) {
    queryParams.name = options.search;
  }

  const pagePromise = client.blueprints.list(queryParams);
  const page = (await pagePromise) as unknown as BlueprintsCursorIDPage<BlueprintView>;

  const blueprints: Blueprint[] = [];

  if (page.blueprints && Array.isArray(page.blueprints)) {
    page.blueprints.forEach((b: BlueprintView) => {
      // CRITICAL: Truncate all strings to prevent Yoga crashes
      const MAX_ID_LENGTH = 100;
      const MAX_NAME_LENGTH = 200;
      const MAX_STATUS_LENGTH = 50;
      const MAX_ARCH_LENGTH = 50;
      const MAX_RESOURCES_LENGTH = 100;

      // Extract architecture and resources from launch_parameters
      const architecture = b.parameters?.launch_parameters?.architecture;
      const resources = b.parameters?.launch_parameters?.resource_size_request;

      blueprints.push({
        id: String(b.id || "").substring(0, MAX_ID_LENGTH),
        name: String(b.name || "").substring(0, MAX_NAME_LENGTH),
        status: String(b.status || "").substring(0, MAX_STATUS_LENGTH),
        create_time_ms: b.create_time_ms,
        build_status: b.status
          ? String(b.status).substring(0, MAX_STATUS_LENGTH)
          : undefined,
        architecture: architecture
          ? String(architecture).substring(0, MAX_ARCH_LENGTH)
          : undefined,
        resources: resources
          ? String(resources).substring(0, MAX_RESOURCES_LENGTH)
          : undefined,
      });
    });
  }

  const result = {
    blueprints,
    totalCount: page.total_count || blueprints.length,
    hasMore: page.has_more || false,
  };

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

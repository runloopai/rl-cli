/**
 * Blueprint Service - Handles all blueprint API calls
 */
import { getClient } from "../utils/client.js";
import type { Blueprint } from "../store/blueprintStore.js";
import type {
  BlueprintListParams,
  BlueprintView,
} from "@runloop/api-client/resources/blueprints";
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
  const page =
    (await pagePromise) as unknown as BlueprintsCursorIDPage<BlueprintView>;

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
        status: b.status,
        state: b.state,
        create_time_ms: b.create_time_ms,
        parameters: b.parameters,
        // UI-specific convenience fields
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

  // Extract architecture and resources from launch_parameters for convenience
  const launchParams = blueprint.parameters?.launch_parameters;

  return {
    // Spread all API fields
    ...blueprint,
    // UI-specific convenience fields
    architecture: launchParams?.architecture ?? undefined,
    resources: launchParams?.resource_size_request ?? undefined,
  };
}

/**
 * Get a single blueprint by ID or name
 */
export async function getBlueprintByIdOrName(
  idOrName: string,
): Promise<Blueprint | null> {
  const client = getClient();

  // Check if it's an ID (starts with bpt_) or a name
  if (idOrName.startsWith("bpt_")) {
    return getBlueprint(idOrName);
  }

  // It's a name, search for it
  const result = await client.blueprints.list({ name: idOrName });
  const blueprints = result.blueprints || [];

  if (blueprints.length === 0) {
    return null;
  }

  // Return the first exact match, or first result if no exact match
  const blueprint =
    blueprints.find((b) => b.name === idOrName) || blueprints[0];
  return getBlueprint(blueprint.id);
}

/**
 * Get blueprint logs
 * Returns the raw logs array from the API response
 * Similar to getDevboxLogs - formatting is handled by logFormatter
 */
export async function getBlueprintLogs(id: string): Promise<any[]> {
  const client = getClient();
  const response = await client.blueprints.logs(id);

  // Return the logs array directly - formatting is handled by logFormatter
  // Ensure timestamp_ms is present (API may return timestamp or timestamp_ms)
  if (response.logs && Array.isArray(response.logs)) {
    return response.logs.map((log: any) => {
      // Normalize timestamp field to timestamp_ms if needed
      // Create a new object to avoid mutating the original
      const normalizedLog = { ...log };
      if (normalizedLog.timestamp && !normalizedLog.timestamp_ms) {
        // If timestamp is a number, use it directly; if it's a string, parse it
        if (typeof normalizedLog.timestamp === "number") {
          normalizedLog.timestamp_ms = normalizedLog.timestamp;
        } else if (typeof normalizedLog.timestamp === "string") {
          normalizedLog.timestamp_ms = new Date(
            normalizedLog.timestamp,
          ).getTime();
        }
      }
      return normalizedLog;
    });
  }

  return [];
}

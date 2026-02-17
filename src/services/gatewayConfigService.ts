/**
 * Gateway Config Service - Handles all gateway config API calls
 */
import { getClient } from "../utils/client.js";
import type { GatewayConfig } from "../store/gatewayConfigStore.js";
import type {
  GatewayConfigListParams,
  GatewayConfigView,
} from "@runloop/api-client/resources/gateway-configs";

export interface ListGatewayConfigsOptions {
  limit: number;
  startingAfter?: string;
  search?: string;
}

export interface ListGatewayConfigsResult {
  gatewayConfigs: GatewayConfig[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * List gateway configs with pagination
 */
export async function listGatewayConfigs(
  options: ListGatewayConfigsOptions,
): Promise<ListGatewayConfigsResult> {
  const client = getClient();

  const queryParams: GatewayConfigListParams = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }
  if (options.search) {
    queryParams.name = options.search;
  }

  const pagePromise = client.gatewayConfigs.list(queryParams);
  const page = await pagePromise;

  const gatewayConfigs: GatewayConfig[] = [];

  if (page.gateway_configs && Array.isArray(page.gateway_configs)) {
    page.gateway_configs.forEach((g: GatewayConfigView) => {
      // CRITICAL: Truncate all strings to prevent Yoga crashes
      const MAX_ID_LENGTH = 100;
      const MAX_NAME_LENGTH = 200;
      const MAX_DESC_LENGTH = 500;
      const MAX_ENDPOINT_LENGTH = 500;

      gatewayConfigs.push({
        id: String(g.id || "").substring(0, MAX_ID_LENGTH),
        name: String(g.name || "").substring(0, MAX_NAME_LENGTH),
        description: g.description
          ? String(g.description).substring(0, MAX_DESC_LENGTH)
          : undefined,
        endpoint: String(g.endpoint || "").substring(0, MAX_ENDPOINT_LENGTH),
        create_time_ms: g.create_time_ms,
        auth_mechanism: {
          type: g.auth_mechanism.type,
          key: g.auth_mechanism.key ?? undefined,
        },
        account_id: g.account_id ?? undefined,
      });
    });
  }

  const result = {
    gatewayConfigs,
    totalCount: page.total_count || gatewayConfigs.length,
    hasMore: page.has_more || false,
  };

  return result;
}

/**
 * Get a single gateway config by ID
 */
export async function getGatewayConfig(id: string): Promise<GatewayConfig> {
  const client = getClient();
  const config = await client.gatewayConfigs.retrieve(id);

  return {
    id: config.id,
    name: config.name,
    description: config.description ?? undefined,
    endpoint: config.endpoint,
    create_time_ms: config.create_time_ms,
    auth_mechanism: {
      type: config.auth_mechanism.type,
      key: config.auth_mechanism.key ?? undefined,
    },
    account_id: config.account_id ?? undefined,
  };
}

/**
 * Get a single gateway config by ID or name
 */
export async function getGatewayConfigByIdOrName(
  idOrName: string,
): Promise<GatewayConfig | null> {
  const client = getClient();

  // Try to retrieve directly by ID first
  try {
    const config = await client.gatewayConfigs.retrieve(idOrName);
    return {
      id: config.id,
      name: config.name,
      description: config.description ?? undefined,
      endpoint: config.endpoint,
      create_time_ms: config.create_time_ms,
      auth_mechanism: {
        type: config.auth_mechanism.type,
        key: config.auth_mechanism.key ?? undefined,
      },
      account_id: config.account_id ?? undefined,
    };
  } catch {
    // Not found by ID, try by name
  }

  // Search by name
  const queryParams: GatewayConfigListParams = {
    limit: 100,
    name: idOrName,
  };
  const pagePromise = client.gatewayConfigs.list(queryParams);
  const page = await pagePromise;

  const configs = page.gateway_configs || [];
  if (configs.length === 0) {
    return null;
  }

  // Return the first exact match, or first result if no exact match
  const match = configs.find((g) => g.name === idOrName) || configs[0];
  return getGatewayConfig(match.id);
}

/**
 * Delete a gateway config
 */
export async function deleteGatewayConfig(id: string): Promise<void> {
  const client = getClient();
  await client.gatewayConfigs.delete(id);
}

/**
 * Create a gateway config
 */
export interface CreateGatewayConfigParams {
  name: string;
  endpoint: string;
  auth_mechanism: {
    type: string;
    key?: string;
  };
  description?: string;
}

export async function createGatewayConfig(
  params: CreateGatewayConfigParams,
): Promise<GatewayConfig> {
  const client = getClient();
  const config = await client.gatewayConfigs.create({
    name: params.name,
    endpoint: params.endpoint,
    auth_mechanism: params.auth_mechanism,
    description: params.description,
  });

  return {
    id: config.id,
    name: config.name,
    description: config.description ?? undefined,
    endpoint: config.endpoint,
    create_time_ms: config.create_time_ms,
    auth_mechanism: {
      type: config.auth_mechanism.type,
      key: config.auth_mechanism.key ?? undefined,
    },
    account_id: config.account_id ?? undefined,
  };
}

/**
 * Update a gateway config
 */
export interface UpdateGatewayConfigParams {
  name?: string;
  endpoint?: string;
  auth_mechanism?: {
    type: string;
    key?: string;
  };
  description?: string;
}

export async function updateGatewayConfig(
  id: string,
  params: UpdateGatewayConfigParams,
): Promise<GatewayConfig> {
  const client = getClient();
  const config = await client.gatewayConfigs.update(id, params);

  return {
    id: config.id,
    name: config.name,
    description: config.description ?? undefined,
    endpoint: config.endpoint,
    create_time_ms: config.create_time_ms,
    auth_mechanism: {
      type: config.auth_mechanism.type,
      key: config.auth_mechanism.key ?? undefined,
    },
    account_id: config.account_id ?? undefined,
  };
}

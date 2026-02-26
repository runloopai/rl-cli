/**
 * MCP Config Service - Handles all MCP config API calls
 */
import { getClient } from "../utils/client.js";
import type { McpConfig } from "../store/mcpConfigStore.js";
import type {
  McpConfigListParams,
  McpConfigView,
} from "@runloop/api-client/resources/mcp-configs";
import type { McpConfigsCursorIDPage } from "@runloop/api-client/pagination";

export interface ListMcpConfigsOptions {
  limit: number;
  startingAfter?: string;
  search?: string;
}

export interface ListMcpConfigsResult {
  mcpConfigs: McpConfig[];
  totalCount: number;
  hasMore: boolean;
}

export async function listMcpConfigs(
  options: ListMcpConfigsOptions,
): Promise<ListMcpConfigsResult> {
  const client = getClient();

  const queryParams: McpConfigListParams = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }
  if (options.search) {
    queryParams.name = options.search;
  }

  const pagePromise = client.mcpConfigs.list(queryParams);
  const page =
    (await pagePromise) as unknown as McpConfigsCursorIDPage<McpConfigView>;

  const mcpConfigs: McpConfig[] = [];

  if (page.mcp_configs && Array.isArray(page.mcp_configs)) {
    const MAX_ID_LENGTH = 100;
    const MAX_NAME_LENGTH = 200;
    const MAX_DESC_LENGTH = 500;
    const MAX_ENDPOINT_LENGTH = 500;

    page.mcp_configs.forEach((m: McpConfigView) => {
      mcpConfigs.push({
        id: String(m.id || "").substring(0, MAX_ID_LENGTH),
        name: String(m.name || "").substring(0, MAX_NAME_LENGTH),
        description: m.description
          ? String(m.description).substring(0, MAX_DESC_LENGTH)
          : undefined,
        endpoint: String(m.endpoint || "").substring(0, MAX_ENDPOINT_LENGTH),
        create_time_ms: m.create_time_ms,
        allowed_tools: Array.isArray(m.allowed_tools) ? m.allowed_tools : [],
      });
    });
  }

  return {
    mcpConfigs,
    totalCount: mcpConfigs.length,
    hasMore: page.has_more || false,
  };
}

export async function getMcpConfig(id: string): Promise<McpConfig> {
  const client = getClient();
  const config = await client.mcpConfigs.retrieve(id);

  return {
    id: config.id,
    name: config.name,
    description: config.description ?? undefined,
    endpoint: config.endpoint,
    create_time_ms: config.create_time_ms,
    allowed_tools: Array.isArray(config.allowed_tools)
      ? config.allowed_tools
      : [],
  };
}

export async function getMcpConfigByIdOrName(
  idOrName: string,
): Promise<McpConfig | null> {
  const client = getClient();

  try {
    const config = await client.mcpConfigs.retrieve(idOrName);
    return {
      id: config.id,
      name: config.name,
      description: config.description ?? undefined,
      endpoint: config.endpoint,
      create_time_ms: config.create_time_ms,
      allowed_tools: Array.isArray(config.allowed_tools)
        ? config.allowed_tools
        : [],
    };
  } catch {
    // Not found by ID, try by name
  }

  const queryParams: McpConfigListParams = {
    limit: 100,
    name: idOrName,
  };
  const pagePromise = client.mcpConfigs.list(queryParams);
  const page =
    (await pagePromise) as unknown as McpConfigsCursorIDPage<McpConfigView>;

  const configs = page.mcp_configs || [];
  if (configs.length === 0) {
    return null;
  }

  const match = configs.find((m) => m.name === idOrName) || configs[0];
  return getMcpConfig(match.id);
}

export async function deleteMcpConfig(id: string): Promise<void> {
  const client = getClient();
  await client.mcpConfigs.delete(id);
}

export interface CreateMcpConfigParams {
  name: string;
  endpoint: string;
  allowed_tools: string[];
  description?: string;
}

export async function createMcpConfig(
  params: CreateMcpConfigParams,
): Promise<McpConfig> {
  const client = getClient();
  const config = await client.mcpConfigs.create({
    name: params.name,
    endpoint: params.endpoint,
    allowed_tools: params.allowed_tools,
    description: params.description,
  });

  return {
    id: config.id,
    name: config.name,
    description: config.description ?? undefined,
    endpoint: config.endpoint,
    create_time_ms: config.create_time_ms,
    allowed_tools: Array.isArray(config.allowed_tools)
      ? config.allowed_tools
      : [],
  };
}

export interface UpdateMcpConfigParams {
  name?: string;
  endpoint?: string;
  allowed_tools?: string[];
  description?: string;
}

export async function updateMcpConfig(
  id: string,
  params: UpdateMcpConfigParams,
): Promise<McpConfig> {
  const client = getClient();
  const config = await client.mcpConfigs.update(id, params);

  return {
    id: config.id,
    name: config.name,
    description: config.description ?? undefined,
    endpoint: config.endpoint,
    create_time_ms: config.create_time_ms,
    allowed_tools: Array.isArray(config.allowed_tools)
      ? config.allowed_tools
      : [],
  };
}

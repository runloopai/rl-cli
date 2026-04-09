/**
 * Agent Service - Handles API calls for agents
 */
import { getClient } from "../utils/client.js";
import type { AgentView } from "@runloop/api-client/resources/agents";

// Re-export types
export type Agent = AgentView;

export interface ListAgentsOptions {
  limit?: number;
  startingAfter?: string;
  publicOnly?: boolean;
  privateOnly?: boolean;
  name?: string;
  search?: string;
  version?: string;
}

export interface ListAgentsResult {
  agents: Agent[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * List agents with pagination
 * Can filter to only return public agents for benchmark jobs
 */
export async function listAgents(
  options: ListAgentsOptions,
): Promise<ListAgentsResult> {
  const client = getClient();

  const queryParams: {
    limit?: number;
    starting_after?: string;
    is_public?: boolean;
    name?: string;
    search?: string;
    version?: string;
  } = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }

  if (options.publicOnly) {
    queryParams.is_public = true;
  } else if (options.privateOnly) {
    queryParams.is_public = false;
  }

  if (options.name) {
    queryParams.name = options.name;
  }

  if (options.search) {
    queryParams.search = options.search;
  }

  if (options.version) {
    queryParams.version = options.version;
  }

  // Use raw HTTP to get has_more from the API response directly
  const response = await (client as any).get("/v1/agents", {
    query: queryParams,
  });
  const agents: Agent[] = response.agents || [];

  return {
    agents,
    totalCount: agents.length,
    hasMore: response.has_more || false,
  };
}

/**
 * Get agent by ID
 */
export async function getAgent(id: string): Promise<Agent> {
  const client = getClient();
  return client.agents.retrieve(id);
}

/**
 * List public agents with pagination
 */
export async function listPublicAgents(
  options: ListAgentsOptions,
): Promise<ListAgentsResult> {
  const client = getClient();

  const queryParams: Record<string, unknown> = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }
  if (options.name) {
    queryParams.name = options.name;
  }
  if (options.search) {
    queryParams.search = options.search;
  }

  // SDK doesn't have agents.listPublic yet, use raw HTTP call
  const response = await (client as any).get("/v1/agents/list_public", {
    query: queryParams,
  });
  const agents: Agent[] = response.agents || [];

  return {
    agents,
    totalCount: agents.length,
    hasMore: response.has_more || false,
  };
}

export interface CreateAgentOptions {
  name: string;
  version: string;
  source?: {
    type: string;
    npm?: {
      package_name: string;
      registry_url?: string;
      agent_setup?: string[];
    };
    pip?: {
      package_name: string;
      registry_url?: string;
      agent_setup?: string[];
    };
    git?: { repository: string; ref?: string; agent_setup?: string[] };
    object?: { object_id: string; agent_setup?: string[] };
  };
}

/**
 * Create a new agent
 */
export async function createAgent(options: CreateAgentOptions): Promise<Agent> {
  const client = getClient();
  return client.agents.create(options);
}

/**
 * Delete an agent by ID
 */
export async function deleteAgent(id: string): Promise<void> {
  const client = getClient();
  // SDK doesn't have agents.delete yet, use raw HTTP call
  await (client as any).post(`/v1/agents/${id}/delete`);
}

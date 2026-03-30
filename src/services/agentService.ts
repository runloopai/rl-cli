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
    limit: options.limit || 50,
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

  const page = await client.agents.list(queryParams);
  const agents: Agent[] = [];

  // Collect agents from the cursor page
  for await (const agent of page) {
    agents.push(agent);
    if (options.limit && agents.length >= options.limit) {
      break;
    }
  }

  return {
    agents,
    totalCount: agents.length,
    hasMore: false, // Cursor pagination doesn't give us this directly
  };
}

/**
 * Get agent by ID
 */
export async function getAgent(id: string): Promise<Agent> {
  const client = getClient();
  return client.agents.retrieve(id);
}

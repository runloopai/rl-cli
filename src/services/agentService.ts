/**
 * Agent Service - Handles API calls for agents
 */
import { getClient } from "../utils/client.js";
import { formatTimeAgo } from "../utils/time.js";
import type { AgentView } from "@runloop/api-client/resources/agents";

// Re-export types
export type Agent = AgentView;

// ---------------------------------------------------------------------------
// Shared agent column definitions
// ---------------------------------------------------------------------------

export interface AgentColumn {
  key: string;
  label: string;
  width: number;
  getValue: (agent: Agent) => string;
}

/**
 * Return the version string, prefixed with the package name when it differs
 * from the agent name. Handles scoped packages (e.g. @scope/pkg) correctly.
 */
function agentVersionText(agent: Agent): string {
  const src = (agent as any).source;
  const pkg: string | undefined =
    src?.npm?.package_name || src?.pip?.package_name;
  const version = agent.version || "";

  // Strip leading @ and any scope prefix for comparison (e.g. "@scope/pkg" -> "pkg")
  const barePkg = pkg?.replace(/^@[^/]+\//, "") ?? "";
  const showPkg = pkg && barePkg !== agent.name;

  if (showPkg && version) {
    return `${pkg}@${version}`;
  }
  if (showPkg) {
    return pkg!;
  }
  return version;
}

// Fixed column widths (content + padding). These values never change.
const SOURCE_WIDTH = 10; // values: "npm", "pip", "git", "object", "-"
const ID_WIDTH = 27; // agent IDs are ~25 chars
const CREATED_WIDTH = 12; // e.g. "3d ago", "2mo ago"
const MIN_FLEX_WIDTH = 10; // minimum for each flexible column (name, version)
const FIXED_TOTAL = SOURCE_WIDTH + ID_WIDTH + CREATED_WIDTH;

/** Column spec before width calculation */
interface AgentColumnSpec {
  key: string;
  label: string;
  getValue: (agent: Agent) => string;
  /** Fixed width (used in trimToFit mode). Flex columns leave this undefined. */
  fixedWidth?: number;
}

const columnSpecs: AgentColumnSpec[] = [
  { key: "name", label: "NAME", getValue: (a) => a.name },
  {
    key: "source",
    label: "SOURCE",
    fixedWidth: SOURCE_WIDTH,
    getValue: (a) => (a as any).source?.type || "-",
  },
  { key: "version", label: "VERSION", getValue: agentVersionText },
  { key: "id", label: "ID", fixedWidth: ID_WIDTH, getValue: (a) => a.id },
  {
    key: "created",
    label: "CREATED",
    fixedWidth: CREATED_WIDTH,
    getValue: (a) => formatTimeAgo(a.create_time_ms),
  },
];

/**
 * Build agent column definitions with widths fitted to `availableWidth`.
 *
 * Column order: NAME, SOURCE, VERSION, ID, CREATED.
 *
 * When `trimToFit` is true (TUI), SOURCE/ID/CREATED use fixed widths and
 * the remaining space is split evenly between NAME and VERSION. Content
 * that overflows is truncated by the Table component.
 *
 * When `trimToFit` is false (CLI), each column is sized to its widest
 * value (or header) plus padding. Columns may exceed `availableWidth`
 * so that all content is visible and columns always align.
 */
export function getAgentColumns(
  agents: Agent[],
  availableWidth: number,
  trimToFit = true,
): AgentColumn[] {
  if (trimToFit) {
    // TUI mode: fixed widths with flex split
    const flexSpace = Math.max(
      MIN_FLEX_WIDTH * 2,
      availableWidth - FIXED_TOTAL,
    );
    const nameWidth = Math.ceil(flexSpace / 2);
    const versionWidth = Math.floor(flexSpace / 2);

    return columnSpecs.map((spec) => ({
      key: spec.key,
      label: spec.label,
      width:
        spec.fixedWidth ?? (spec.key === "name" ? nameWidth : versionWidth),
      getValue: spec.getValue,
    }));
  }

  // CLI mode: size each column to its content
  const COL_PAD = 2;
  return columnSpecs.map((spec) => {
    let maxLen = spec.label.length;
    for (const agent of agents) {
      maxLen = Math.max(maxLen, spec.getValue(agent).length);
    }
    return {
      key: spec.key,
      label: spec.label,
      width: maxLen + COL_PAD,
      getValue: spec.getValue,
    };
  });
}

export interface ListAgentsOptions {
  limit?: number;
  startingAfter?: string;
  publicOnly?: boolean;
  privateOnly?: boolean;
  name?: string;
  search?: string;
  version?: string;
  includeTotalCount?: boolean;
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
    include_total_count?: boolean;
  } = {
    limit: options.limit,
  };

  if (options.includeTotalCount !== undefined) {
    queryParams.include_total_count = options.includeTotalCount;
  }

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

  // Use raw HTTP to get has_more and total_count from the API response directly
  const response = await (client as any).get("/v1/agents", {
    query: queryParams,
  });
  const agents: Agent[] = response.agents || [];

  return {
    agents,
    totalCount: response.total_count ?? agents.length,
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
  if (options.includeTotalCount !== undefined) {
    queryParams.include_total_count = options.includeTotalCount;
  }

  // SDK doesn't have agents.listPublic yet, use raw HTTP call
  const response = await (client as any).get("/v1/agents/list_public", {
    query: queryParams,
  });
  const agents: Agent[] = response.agents || [];

  return {
    agents,
    totalCount: response.total_count ?? agents.length,
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

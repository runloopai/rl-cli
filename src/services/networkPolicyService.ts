/**
 * Network Policy Service - Handles all network policy API calls
 */
import { getClient } from "../utils/client.js";
import type { NetworkPolicy } from "../store/networkPolicyStore.js";
import type {
  NetworkPolicyListParams,
  NetworkPolicyView,
} from "@runloop/api-client/resources/network-policies";
import type { NetworkPoliciesCursorIDPage } from "@runloop/api-client/pagination";

export interface ListNetworkPoliciesOptions {
  limit: number;
  startingAfter?: string;
  search?: string;
}

export interface ListNetworkPoliciesResult {
  networkPolicies: NetworkPolicy[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * List network policies with pagination
 */
export async function listNetworkPolicies(
  options: ListNetworkPoliciesOptions,
): Promise<ListNetworkPoliciesResult> {
  const client = getClient();

  const queryParams: NetworkPolicyListParams = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }
  if (options.search) {
    queryParams.name = options.search;
  }

  const pagePromise = client.networkPolicies.list(queryParams);
  const page =
    (await pagePromise) as unknown as NetworkPoliciesCursorIDPage<NetworkPolicyView>;

  const networkPolicies: NetworkPolicy[] = [];

  if (page.network_policies && Array.isArray(page.network_policies)) {
    page.network_policies.forEach((p: NetworkPolicyView) => {
      // CRITICAL: Truncate all strings to prevent Yoga crashes
      const MAX_ID_LENGTH = 100;
      const MAX_NAME_LENGTH = 200;
      const MAX_DESC_LENGTH = 500;

      networkPolicies.push({
        id: String(p.id || "").substring(0, MAX_ID_LENGTH),
        name: String(p.name || "").substring(0, MAX_NAME_LENGTH),
        description: p.description
          ? String(p.description).substring(0, MAX_DESC_LENGTH)
          : undefined,
        create_time_ms: p.create_time_ms,
        update_time_ms: p.update_time_ms,
        egress: {
          allow_all: p.egress.allow_all,
          allow_devbox_to_devbox: p.egress.allow_devbox_to_devbox,
          allowed_hostnames: p.egress.allowed_hostnames || [],
        },
      });
    });
  }

  const result = {
    networkPolicies,
    totalCount: networkPolicies.length,
    hasMore: page.has_more || false,
  };

  return result;
}

/**
 * Get a single network policy by ID
 */
export async function getNetworkPolicy(id: string): Promise<NetworkPolicy> {
  const client = getClient();
  const policy = await client.networkPolicies.retrieve(id);

  return {
    id: policy.id,
    name: policy.name,
    description: policy.description ?? undefined,
    create_time_ms: policy.create_time_ms,
    update_time_ms: policy.update_time_ms,
    egress: {
      allow_all: policy.egress.allow_all,
      allow_devbox_to_devbox: policy.egress.allow_devbox_to_devbox,
      allowed_hostnames: policy.egress.allowed_hostnames || [],
    },
  };
}

/**
 * Get a single network policy by ID or name
 */
export async function getNetworkPolicyByIdOrName(
  idOrName: string,
): Promise<NetworkPolicy | null> {
  if (idOrName.startsWith("np_")) {
    try {
      return await getNetworkPolicy(idOrName);
    } catch {
      return null;
    }
  }

  const result = await listNetworkPolicies({
    limit: 100,
    search: idOrName,
  });

  const match = result.networkPolicies.find((p) => p.name === idOrName);
  return match ?? null;
}

/**
 * Delete a network policy
 */
export async function deleteNetworkPolicy(id: string): Promise<void> {
  const client = getClient();
  await client.networkPolicies.delete(id);
}

/**
 * Create a network policy
 */
export interface CreateNetworkPolicyParams {
  name: string;
  description?: string;
  allow_all?: boolean;
  allow_devbox_to_devbox?: boolean;
  allowed_hostnames?: string[];
}

export async function createNetworkPolicy(
  params: CreateNetworkPolicyParams,
): Promise<NetworkPolicy> {
  const client = getClient();
  const policy = await client.networkPolicies.create(params);

  return {
    id: policy.id,
    name: policy.name,
    description: policy.description ?? undefined,
    create_time_ms: policy.create_time_ms,
    update_time_ms: policy.update_time_ms,
    egress: {
      allow_all: policy.egress.allow_all,
      allow_devbox_to_devbox: policy.egress.allow_devbox_to_devbox,
      allowed_hostnames: policy.egress.allowed_hostnames || [],
    },
  };
}

/**
 * Update a network policy
 */
export interface UpdateNetworkPolicyParams {
  name?: string;
  description?: string;
  allow_all?: boolean;
  allow_devbox_to_devbox?: boolean;
  allowed_hostnames?: string[];
}

export async function updateNetworkPolicy(
  id: string,
  params: UpdateNetworkPolicyParams,
): Promise<NetworkPolicy> {
  const client = getClient();
  const policy = await client.networkPolicies.update(id, params);

  return {
    id: policy.id,
    name: policy.name,
    description: policy.description ?? undefined,
    create_time_ms: policy.create_time_ms,
    update_time_ms: policy.update_time_ms,
    egress: {
      allow_all: policy.egress.allow_all,
      allow_devbox_to_devbox: policy.egress.allow_devbox_to_devbox,
      allowed_hostnames: policy.egress.allowed_hostnames || [],
    },
  };
}

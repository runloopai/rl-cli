/**
 * Get network policy details command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface GetNetworkPolicyOptions {
  id: string;
  output?: string;
}

export async function getNetworkPolicy(options: GetNetworkPolicyOptions) {
  try {
    const client = getClient();
    const policy = await client.networkPolicies.retrieve(options.id);
    output(policy, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get network policy", error);
  }
}

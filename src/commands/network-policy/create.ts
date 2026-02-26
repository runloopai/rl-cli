/**
 * Create network policy command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface CreateOptions {
  name: string;
  description?: string;
  allowAll?: boolean;
  allowDevboxToDevbox?: boolean;
  allowAgentGateway?: boolean;
  allowMcpGateway?: boolean;
  allowedHostnames?: string[];
  output?: string;
}

export async function createNetworkPolicy(options: CreateOptions) {
  try {
    const client = getClient();

    const policy = await client.networkPolicies.create({
      name: options.name,
      description: options.description,
      allow_all: options.allowAll ?? false,
      allow_devbox_to_devbox: options.allowDevboxToDevbox ?? false,
      allow_agent_gateway: options.allowAgentGateway ?? false,
      allow_mcp_gateway: options.allowMcpGateway ?? false,
      allowed_hostnames: options.allowedHostnames ?? [],
    });

    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      console.log(policy.id);
    } else {
      output(policy, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to create network policy", error);
  }
}

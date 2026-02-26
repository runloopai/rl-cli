/**
 * Create devbox command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface CreateOptions {
  name?: string;
  template?: string;
  snapshot?: string;
  blueprint?: string;
  resources?: string;
  architecture?: string;
  entrypoint?: string;
  launchCommands?: string[];
  envVars?: string[];
  secrets?: string[];
  codeMounts?: string[];
  idleTime?: string;
  idleAction?: string;
  availablePorts?: string[];
  root?: boolean;
  user?: string;
  networkPolicy?: string;
  tunnel?: string;
  gateways?: string[];
  mcp?: string[];
  output?: string;
}

// Parse environment variables from KEY=value format
function parseEnvVars(envVars: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const envVar of envVars) {
    const eqIndex = envVar.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(
        `Invalid environment variable format: ${envVar}. Expected KEY=value`,
      );
    }
    const key = envVar.substring(0, eqIndex);
    const value = envVar.substring(eqIndex + 1);
    result[key] = value;
  }
  return result;
}

// Parse secrets from ENV_VAR=SECRET_NAME format
function parseSecrets(secrets: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const secret of secrets) {
    const eqIndex = secret.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(
        `Invalid secret format: ${secret}. Expected ENV_VAR=SECRET_NAME`,
      );
    }
    const envVarName = secret.substring(0, eqIndex);
    const secretName = secret.substring(eqIndex + 1);
    result[envVarName] = secretName;
  }
  return result;
}

// Parse code mounts from JSON format
function parseCodeMounts(codeMounts: string[]): unknown[] {
  return codeMounts.map((mount) => {
    try {
      return JSON.parse(mount);
    } catch {
      throw new Error(`Invalid code mount JSON: ${mount}`);
    }
  });
}

// Parse gateways from ENV_PREFIX=gateway,secret format
function parseGateways(
  gateways: string[],
): Record<string, { gateway: string; secret: string }> {
  const result: Record<string, { gateway: string; secret: string }> = {};
  for (const gateway of gateways) {
    const eqIndex = gateway.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(
        `Invalid gateway format: ${gateway}. Expected ENV_PREFIX=gateway_id_or_name,secret_id_or_name`,
      );
    }
    const envPrefix = gateway.substring(0, eqIndex);
    const valueStr = gateway.substring(eqIndex + 1);

    // Split by comma to get gateway and secret
    const commaIndex = valueStr.indexOf(",");
    if (commaIndex === -1) {
      throw new Error(
        `Invalid gateway format: ${gateway}. Expected ENV_PREFIX=gateway_id_or_name,secret_id_or_name`,
      );
    }
    const gatewayIdOrName = valueStr.substring(0, commaIndex);
    const secretIdOrName = valueStr.substring(commaIndex + 1);

    if (!envPrefix || !gatewayIdOrName || !secretIdOrName) {
      throw new Error(
        `Invalid gateway format: ${gateway}. Expected ENV_PREFIX=gateway_id_or_name,secret_id_or_name`,
      );
    }

    result[envPrefix] = {
      gateway: gatewayIdOrName,
      secret: secretIdOrName,
    };
  }
  return result;
}

function parseMcpSpecs(
  specs: string[],
): Array<{ mcp_config: string; secret: string }> {
  return specs.map((spec) => {
    const commaIndex = spec.indexOf(",");
    if (commaIndex === -1) {
      throw new Error(
        `Invalid MCP spec format: ${spec}. Expected mcp_config_id_or_name,secret_id_or_name`,
      );
    }
    const mcpConfig = spec.substring(0, commaIndex);
    const secret = spec.substring(commaIndex + 1);

    if (!mcpConfig || !secret) {
      throw new Error(
        `Invalid MCP spec format: ${spec}. Expected mcp_config_id_or_name,secret_id_or_name`,
      );
    }

    return { mcp_config: mcpConfig, secret };
  });
}

export async function createDevbox(options: CreateOptions = {}) {
  try {
    const client = getClient();

    // Parse user parameters
    let userParameters = undefined;
    if (options.user && options.root) {
      outputError("Only one of --user or --root can be specified");
    } else if (options.user) {
      const [username, uid] = options.user.split(":");
      if (!username || !uid) {
        outputError("User must be in format 'username:uid'");
      }
      userParameters = { username, uid: parseInt(uid) };
    } else if (options.root) {
      userParameters = { username: "root", uid: 0 };
    }

    // Validate idle options
    if (
      (options.idleTime && !options.idleAction) ||
      (!options.idleTime && options.idleAction)
    ) {
      outputError(
        "Both --idle-time and --idle-action must be specified together",
      );
    }

    // Validate tunnel option
    if (options.tunnel && !["open", "authenticated"].includes(options.tunnel)) {
      outputError(
        "Invalid tunnel mode. Must be either 'open' or 'authenticated'",
      );
    }

    // Build launch parameters
    const launchParameters: Record<string, unknown> = {};
    if (options.resources) {
      launchParameters.resource_size_request = options.resources;
    }
    if (options.architecture) {
      launchParameters.architecture = options.architecture;
    }
    if (options.launchCommands) {
      launchParameters.launch_commands = options.launchCommands;
    }
    if (options.availablePorts) {
      launchParameters.available_ports = options.availablePorts.map((p) =>
        parseInt(p, 10),
      );
    }
    if (userParameters) {
      launchParameters.user_parameters = userParameters;
    }
    if (options.idleTime && options.idleAction) {
      launchParameters.after_idle = {
        idle_time_seconds: parseInt(options.idleTime, 10),
        on_idle: options.idleAction,
      };
    }
    if (options.networkPolicy) {
      launchParameters.network_policy_id = options.networkPolicy;
    }

    // Build create request
    const createRequest: Record<string, unknown> = {
      name: options.name || `devbox-${Date.now()}`,
    };

    // Handle snapshot (--template and --snapshot are aliases)
    const snapshotId = options.snapshot || options.template;
    if (snapshotId) {
      createRequest.snapshot_id = snapshotId;
    }

    // Handle blueprint - can be either ID or name
    if (options.blueprint) {
      // If it looks like an ID (starts with bp_ or similar pattern), use blueprint_id
      // Otherwise, use blueprint_name
      if (
        options.blueprint.startsWith("bp_") ||
        options.blueprint.startsWith("bpt_")
      ) {
        createRequest.blueprint_id = options.blueprint;
      } else {
        createRequest.blueprint_name = options.blueprint;
      }
    }

    // Handle entrypoint
    if (options.entrypoint) {
      createRequest.entrypoint = options.entrypoint;
    }

    // Handle environment variables
    if (options.envVars && options.envVars.length > 0) {
      createRequest.environment_variables = parseEnvVars(options.envVars);
    }

    // Handle code mounts
    if (options.codeMounts && options.codeMounts.length > 0) {
      createRequest.code_mounts = parseCodeMounts(options.codeMounts);
    }

    // Handle secrets
    if (options.secrets && options.secrets.length > 0) {
      createRequest.secrets = parseSecrets(options.secrets);
    }

    // Handle tunnel configuration
    if (options.tunnel) {
      createRequest.tunnel = {
        auth_mode: options.tunnel,
      };
    }

    // Handle gateways
    if (options.gateways && options.gateways.length > 0) {
      createRequest.gateways = parseGateways(options.gateways);
    }

    // Handle MCP configs
    if (options.mcp && options.mcp.length > 0) {
      createRequest.mcp = parseMcpSpecs(options.mcp);
    }

    if (Object.keys(launchParameters).length > 0) {
      createRequest.launch_parameters = launchParameters;
    }

    const devbox = await client.devboxes.create(
      createRequest as Parameters<typeof client.devboxes.create>[0],
    );

    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      console.log(devbox.id);
    } else {
      output(devbox, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to create devbox", error);
  }
}

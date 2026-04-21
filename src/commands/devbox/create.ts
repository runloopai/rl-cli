/**
 * Create devbox command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import {
  listAgents,
  getAgent,
  type Agent,
} from "../../services/agentService.js";
import { getObject } from "../../services/objectService.js";

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
  agent?: string[];
  object?: string[];
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
): Record<string, { mcp_config: string; secret: string }> {
  const result: Record<string, { mcp_config: string; secret: string }> = {};
  for (const spec of specs) {
    const eqIndex = spec.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(
        `Invalid MCP spec format: ${spec}. Expected ENV_VAR_NAME=mcp_config_id_or_name,secret_id_or_name`,
      );
    }
    const envVarName = spec.substring(0, eqIndex);
    const valueStr = spec.substring(eqIndex + 1);

    const commaIndex = valueStr.indexOf(",");
    if (commaIndex === -1) {
      throw new Error(
        `Invalid MCP spec format: ${spec}. Expected ENV_VAR_NAME=mcp_config_id_or_name,secret_id_or_name`,
      );
    }
    const mcpConfig = valueStr.substring(0, commaIndex);
    const secret = valueStr.substring(commaIndex + 1);

    if (!envVarName || !mcpConfig || !secret) {
      throw new Error(
        `Invalid MCP spec format: ${spec}. Expected ENV_VAR_NAME=mcp_config_id_or_name,secret_id_or_name`,
      );
    }

    result[envVarName] = { mcp_config: mcpConfig, secret };
  }
  return result;
}

const DEFAULT_MOUNT_PATH = "/home/user";

function sanitizeMountSegment(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function adjustFileExtension(name: string, contentType?: string): string {
  const archiveExts = /\.(tar\.gz|tar\.bz2|tar\.xz|tgz|gz|bz2|xz|zip|tar)$/i;
  const stripped = name.replace(archiveExts, "");
  if (stripped !== name) return stripped;
  if (contentType && /tar|gzip|x-compressed/i.test(contentType)) {
    const dotIdx = name.lastIndexOf(".");
    if (dotIdx > 0) return name.substring(0, dotIdx);
  }
  return name;
}

function repoBasename(repo: string): string | undefined {
  const cleaned = repo
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  const m = cleaned.match(/(?:[/:])([^/:\s]+?)(?:\.git)?$/);
  return m?.[1];
}

function getDefaultAgentMountPath(agent: Agent): string {
  const source = agent.source as
    | { type?: string; git?: { repository?: string } }
    | undefined;
  if (source?.git?.repository) {
    const base = repoBasename(source.git.repository);
    if (base) {
      const s = sanitizeMountSegment(base);
      if (s) return `${DEFAULT_MOUNT_PATH}/${s}`;
    }
  }
  if (agent.name) {
    const s = sanitizeMountSegment(agent.name);
    if (s) return `${DEFAULT_MOUNT_PATH}/${s}`;
  }
  return `${DEFAULT_MOUNT_PATH}/agent`;
}

async function resolveAgent(idOrName: string): Promise<Agent> {
  if (idOrName.startsWith("agt_")) {
    return getAgent(idOrName);
  }
  const result = await listAgents({ name: idOrName });
  const matches = result.agents.filter((a) => a.name === idOrName);
  if (matches.length === 0) {
    throw new Error(`No agent found with name: ${idOrName}`);
  }
  matches.sort((a, b) => b.create_time_ms - a.create_time_ms);
  return matches[0];
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

    // Parse agent mounts (format: name_or_id or name_or_id:/mount/path)
    const resolvedAgents: { agent: Agent; path?: string }[] = [];
    if (options.agent && options.agent.length > 0) {
      for (const spec of options.agent) {
        const colonIdx = spec.indexOf(":");
        // Only treat colon as separator if what follows looks like an absolute path
        let idOrName: string;
        let path: string | undefined;
        if (colonIdx > 0 && spec[colonIdx + 1] === "/") {
          idOrName = spec.substring(0, colonIdx);
          path = spec.substring(colonIdx + 1);
        } else {
          idOrName = spec;
        }
        const agent = await resolveAgent(idOrName);
        resolvedAgents.push({ agent, path });
      }
    }

    // Parse object mounts (format: object_id or object_id:/mount/path)
    const objectMounts: { object_id: string; object_path: string }[] = [];
    if (options.object && options.object.length > 0) {
      for (const spec of options.object) {
        const colonIdx = spec.indexOf(":");
        let objectId: string;
        let objectPath: string;
        if (colonIdx > 0 && spec[colonIdx + 1] === "/") {
          objectId = spec.substring(0, colonIdx);
          objectPath = spec.substring(colonIdx + 1);
        } else {
          // No path specified — fetch object to generate default
          objectId = spec;
          const obj = await getObject(objectId);
          const name = (obj as any).name as string | undefined;
          const contentType = (obj as any).content_type as string | undefined;
          if (name) {
            const adjusted = adjustFileExtension(name, contentType);
            const s = sanitizeMountSegment(adjusted);
            objectPath = s
              ? `${DEFAULT_MOUNT_PATH}/${s}`
              : `${DEFAULT_MOUNT_PATH}/object_${objectId.slice(-8)}`;
          } else {
            objectPath = `${DEFAULT_MOUNT_PATH}/object_${objectId.slice(-8)}`;
          }
        }
        objectMounts.push({ object_id: objectId, object_path: objectPath });
      }
    }

    // Add mounts (agents + objects)
    if (resolvedAgents.length > 0 || objectMounts.length > 0) {
      if (!createRequest.mounts) createRequest.mounts = [];
      for (const { agent, path } of resolvedAgents) {
        const mount: Record<string, unknown> = {
          type: "agent_mount",
          agent_id: agent.id,
          agent_name: null,
        };
        const sourceType = agent.source?.type;
        const needsPath = sourceType === "git" || sourceType === "object";
        const effectivePath =
          path || (needsPath ? getDefaultAgentMountPath(agent) : undefined);
        if (effectivePath) {
          mount.agent_path = effectivePath;
        }
        (createRequest.mounts as unknown[]).push(mount);
      }
      for (const om of objectMounts) {
        (createRequest.mounts as unknown[]).push({
          type: "object_mount",
          object_id: om.object_id,
          object_path: om.object_path,
        });
      }
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

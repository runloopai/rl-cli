/**
 * Cartridge applier — creates inline objects and launches devbox
 */

import { getClient } from "../utils/client.js";
import { createNetworkPolicy } from "../services/networkPolicyService.js";
import { createGatewayConfig } from "../services/gatewayConfigService.js";
import type {
  DevboxCartridge,
  NetworkPolicyInline,
  GatewayConfigInline,
  ResolutionReport,
  ApplyResult,
} from "./types.js";

export async function applyCartridge(
  cartridge: DevboxCartridge,
  report: ResolutionReport,
): Promise<ApplyResult> {
  if (report.missingReferences.length > 0) {
    const names = report.missingReferences
      .map((r) => `${r.type}: ${r.cartridgeName}`)
      .join(", ");
    throw new Error(`Cannot apply cartridge — missing references: ${names}`);
  }

  const createdObjects: Array<{ type: string; name: string; id: string }> = [];

  // Collect resolved IDs indexed by type+name for easy lookup
  const resolvedIds = new Map<string, string>();
  for (const ref of report.references) {
    if (ref.resolvedId) {
      resolvedIds.set(`${ref.type}:${ref.cartridgeName}`, ref.resolvedId);
    }
  }

  // Create inline network policies
  let networkPolicyId: string | undefined;
  if (cartridge.network?.policy) {
    if (typeof cartridge.network.policy === "string") {
      networkPolicyId = resolvedIds.get(
        `network_policy:${cartridge.network.policy}`,
      );
    } else {
      const inline = cartridge.network.policy as NetworkPolicyInline;
      const existingId = resolvedIds.get(`network_policy:${inline.name}`);
      if (existingId) {
        networkPolicyId = existingId;
      } else {
        const created = await createNetworkPolicy({
          name: inline.name,
          description: inline.description,
          allow_all: inline.allow_all,
          allow_devbox_to_devbox: inline.allow_devbox_to_devbox,
          allowed_hostnames: inline.allowed_hostnames,
        });
        networkPolicyId = created.id;
        createdObjects.push({
          type: "network_policy",
          name: inline.name,
          id: created.id,
        });
      }
    }
  }

  // Create inline gateway configs
  const gatewayMap: Record<string, { gateway: string; secret: string }> = {};
  if (cartridge.gateways) {
    for (const [envPrefix, gwDef] of Object.entries(cartridge.gateways)) {
      let configId: string;
      if (typeof gwDef.config === "string") {
        configId =
          resolvedIds.get(`gateway_config:${gwDef.config}`) || gwDef.config;
      } else {
        const inline = gwDef.config as GatewayConfigInline;
        const existingId = resolvedIds.get(
          `gateway_config:${envPrefix}:${inline.name}`,
        );
        if (existingId) {
          configId = existingId;
        } else {
          const created = await createGatewayConfig({
            name: inline.name,
            endpoint: inline.endpoint,
            auth_mechanism: inline.auth_mechanism,
            description: inline.description,
          });
          configId = created.id;
          createdObjects.push({
            type: "gateway_config",
            name: inline.name,
            id: created.id,
          });
        }
      }
      gatewayMap[envPrefix] = {
        gateway: configId,
        secret: gwDef.secret,
      };
    }
  }

  // Build devbox create request
  const createRequest: Record<string, unknown> = {
    name: cartridge.name,
  };

  // Blueprint
  if (cartridge.blueprint) {
    if (
      cartridge.blueprint.startsWith("bp_") ||
      cartridge.blueprint.startsWith("bpt_")
    ) {
      createRequest.blueprint_id = cartridge.blueprint;
    } else {
      createRequest.blueprint_name = cartridge.blueprint;
    }
  }

  // Snapshot
  if (cartridge.snapshot) {
    createRequest.snapshot_id = cartridge.snapshot;
  }

  // Secrets
  if (cartridge.secrets && Object.keys(cartridge.secrets).length > 0) {
    createRequest.secrets = cartridge.secrets;
  }

  // Tunnel
  if (cartridge.network?.tunnel) {
    createRequest.tunnel = { auth_mode: cartridge.network.tunnel };
  }

  // Gateways
  if (Object.keys(gatewayMap).length > 0) {
    createRequest.gateways = gatewayMap;
  }

  // Entrypoint
  if (cartridge.launch?.entrypoint) {
    createRequest.entrypoint = cartridge.launch.entrypoint;
  }

  // Environment variables
  if (cartridge.launch?.env && Object.keys(cartridge.launch.env).length > 0) {
    createRequest.environment_variables = cartridge.launch.env;
  }

  // Code mounts
  if (
    cartridge.launch?.code_mounts &&
    cartridge.launch.code_mounts.length > 0
  ) {
    createRequest.code_mounts = cartridge.launch.code_mounts;
  }

  // Launch parameters
  const launchParameters: Record<string, unknown> = {};

  if (cartridge.resources?.size) {
    launchParameters.resource_size_request = cartridge.resources.size;
  }
  if (cartridge.architecture) {
    launchParameters.architecture = cartridge.architecture;
  }
  if (cartridge.launch?.commands && cartridge.launch.commands.length > 0) {
    launchParameters.launch_commands = cartridge.launch.commands;
  }
  if (cartridge.launch?.ports && cartridge.launch.ports.length > 0) {
    launchParameters.available_ports = cartridge.launch.ports;
  }
  if (cartridge.idle) {
    launchParameters.after_idle = {
      idle_time_seconds: cartridge.idle.timeout_seconds,
      on_idle: cartridge.idle.action,
    };
  }
  if (networkPolicyId) {
    launchParameters.network_policy_id = networkPolicyId;
  }

  if (Object.keys(launchParameters).length > 0) {
    createRequest.launch_parameters = launchParameters;
  }

  // Create the devbox
  const client = getClient();
  const devbox = await client.devboxes.create(
    createRequest as Parameters<typeof client.devboxes.create>[0],
  );

  return {
    devboxId: devbox.id,
    createdObjects,
  };
}

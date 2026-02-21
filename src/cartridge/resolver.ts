/**
 * Cartridge resolver — resolves all references against the backend
 */

import { getClient } from "../utils/client.js";
import { getBlueprintByIdOrName } from "../services/blueprintService.js";
import { getSnapshot } from "../services/snapshotService.js";
import { getNetworkPolicyByIdOrName } from "../services/networkPolicyService.js";
import { getGatewayConfigByIdOrName } from "../services/gatewayConfigService.js";
import type {
  DevboxCartridge,
  NetworkPolicyInline,
  GatewayConfigInline,
  ResolvedReference,
  ResolutionReport,
} from "./types.js";

export async function resolveCartridge(
  cartridge: DevboxCartridge,
): Promise<ResolutionReport> {
  const references: ResolvedReference[] = [];

  // Layer 0 — Blueprint
  if (cartridge.blueprint) {
    const bp = await getBlueprintByIdOrName(cartridge.blueprint);
    references.push({
      type: "blueprint",
      cartridgeName: cartridge.blueprint,
      resolvedId: bp?.id ?? null,
      found: bp !== null,
      isInline: false,
    });
  }

  // Layer 0 — Snapshot
  if (cartridge.snapshot) {
    let snapshotId: string | null = null;
    try {
      const snap = await getSnapshot(cartridge.snapshot);
      snapshotId = snap.id;
    } catch {
      // not found
    }
    references.push({
      type: "snapshot",
      cartridgeName: cartridge.snapshot,
      resolvedId: snapshotId,
      found: snapshotId !== null,
      isInline: false,
    });
  }

  // Layer 1 — Secrets
  if (cartridge.secrets && Object.keys(cartridge.secrets).length > 0) {
    const client = getClient();
    const secretsResult = await client.secrets.list({ limit: 5000 });
    const allSecrets = secretsResult.secrets || [];

    for (const [envVar, secretName] of Object.entries(cartridge.secrets)) {
      const found = allSecrets.find(
        (s: { name?: string }) => s.name === secretName,
      );
      references.push({
        type: "secret",
        cartridgeName: `${envVar}=${secretName}`,
        resolvedId: found ? secretName : null,
        found: !!found,
        isInline: false,
      });
    }
  }

  // Layer 2 — Network Policy
  if (cartridge.network?.policy) {
    const policy = cartridge.network.policy;
    if (typeof policy === "string") {
      const np = await getNetworkPolicyByIdOrName(policy);
      references.push({
        type: "network_policy",
        cartridgeName: policy,
        resolvedId: np?.id ?? null,
        found: np !== null,
        isInline: false,
      });
    } else {
      // Inline definition — check if it already exists by name
      const inline = policy as NetworkPolicyInline;
      const existing = await getNetworkPolicyByIdOrName(inline.name);
      references.push({
        type: "network_policy",
        cartridgeName: inline.name,
        resolvedId: existing?.id ?? null,
        found: existing !== null,
        isInline: true,
      });
    }
  }

  // Layer 2 — Gateway Configs
  if (cartridge.gateways) {
    for (const [envPrefix, gwDef] of Object.entries(cartridge.gateways)) {
      if (typeof gwDef.config === "string") {
        const gc = await getGatewayConfigByIdOrName(gwDef.config);
        references.push({
          type: "gateway_config",
          cartridgeName: gwDef.config,
          resolvedId: gc?.id ?? null,
          found: gc !== null,
          isInline: false,
        });
      } else {
        // Inline definition — check if it already exists by name
        const inline = gwDef.config as GatewayConfigInline;
        const existing = await getGatewayConfigByIdOrName(inline.name);
        references.push({
          type: "gateway_config",
          cartridgeName: `${envPrefix}:${inline.name}`,
          resolvedId: existing?.id ?? null,
          found: existing !== null,
          isInline: true,
        });
      }
    }
  }

  const missingReferences = references.filter((r) => !r.found && !r.isInline);
  const inlineToCreate = references.filter((r) => !r.found && r.isInline);

  return {
    cartridgeName: cartridge.name,
    references,
    allResolved: missingReferences.length === 0,
    missingReferences,
    inlineToCreate,
  };
}

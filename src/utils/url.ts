/**
 * Utility functions for generating URLs
 */

import { platformBaseUrl, tunnelBaseHostname } from "./config.js";

/**
 * Generate a devbox URL for the given devbox ID
 */
export function getDevboxUrl(devboxId: string): string {
  return `${platformBaseUrl()}/devboxes/${devboxId}`;
}

/**
 * Generate a blueprint URL for the given blueprint ID
 */
export function getBlueprintUrl(blueprintId: string): string {
  return `${platformBaseUrl()}/blueprints/${blueprintId}`;
}

/**
 * Generate an agent URL for the given agent ID
 */
export function getAgentUrl(agentId: string): string {
  return `${platformBaseUrl()}/agents/${agentId}`;
}

/**
 * Generate an axon URL for the given axon ID
 */
export function getAxonUrl(axonId: string): string {
  return `${platformBaseUrl()}/axons/${axonId}`;
}

/**
 * Generate a benchmark URL for the given benchmark ID
 */
export function getBenchmarkUrl(
  benchmarkId: string,
  isPublic: boolean,
): string {
  const segment = isPublic ? "public" : "custom";
  return `${platformBaseUrl()}/benchmarks/${segment}/${benchmarkId}`;
}

/**
 * Generate a benchmark run URL for the given benchmark run ID
 */
export function getBenchmarkRunUrl(
  benchmarkRunId: string,
  benchmarkId?: string | null,
): string {
  const bmSegment = benchmarkId ?? "single";
  return `${platformBaseUrl()}/benchmarks/custom/${bmSegment}/runs/${benchmarkRunId}`;
}

/**
 * Generate a scenario run URL for the given scenario and run IDs
 */
export function getScenarioRunUrl(
  scenarioId: string,
  scenarioRunId: string,
): string {
  return `${platformBaseUrl()}/scenarios/${scenarioId}/runs/${scenarioRunId}`;
}

/**
 * Generate a settings URL
 */
export function getSettingsUrl(): string {
  return `${platformBaseUrl()}/settings`;
}

/**
 * Public URL for a devbox tunnel: `https://{remotePort}-{tunnelKey}.tunnel.<domain>`.
 * User port-forwards pass the chosen remote port; PTY (Rage REST) uses port 13 via
 * `getPtyTunnelBaseUrl` → `getTunnelUrl(13, tunnelKey)`. The `tunnel.` hostname
 * segment is required (see `tunnelBaseHostname()`), e.g. not `13-{key}.runloop.pro`.
 *
 * Pass a number for a real URL, or a string like "{port}" for a display pattern.
 */
export function getTunnelUrl(port: number | string, tunnelKey: string): string {
  return `https://${port}-${tunnelKey}.${tunnelBaseHostname()}`;
}

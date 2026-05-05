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

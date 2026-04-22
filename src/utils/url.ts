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
 * Generate a tunnel URL for the given port and tunnel key.
 * Pass a number for a real URL, or a string like "{port}" for a display pattern.
 */
export function getTunnelUrl(
  port: number | string,
  tunnelKey: string,
): string {
  return `https://${port}-${tunnelKey}.${tunnelBaseHostname()}`;
}

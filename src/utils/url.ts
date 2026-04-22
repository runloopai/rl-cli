/**
 * Utility functions for generating URLs
 */

import { platformBaseUrl, tunnelBaseHostname } from "./config.js";

/**
 * Web platform base URL (browser). With `RUNLOOP_BASE_DOMAIN=example.com`,
 * uses `https://platform.example.com`; otherwise `RUNLOOP_ENV` picks .pro vs .ai.
 */
export function getBaseUrl(): string {
  return platformBaseUrl();
}

/**
 * Generate a devbox URL for the given devbox ID
 */
export function getDevboxUrl(devboxId: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/devboxes/${devboxId}`;
}

/**
 * Generate a blueprint URL for the given blueprint ID
 */
export function getBlueprintUrl(blueprintId: string): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/blueprints/${blueprintId}`;
}

/**
 * Generate a settings URL
 */
export function getSettingsUrl(): string {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/settings`;
}

/**
 * Hostname for V2 devbox tunnel URLs (`tunnel.<RUNLOOP_BASE_DOMAIN>` when set).
 */
export function getTunnelBaseHost(): string {
  return tunnelBaseHostname();
}

/**
 * Tunnel URL pattern with a literal `{port}` placeholder for display.
 */
export function getDevboxTunnelUrlPattern(tunnelKey: string): string {
  return `https://{port}-${tunnelKey}.${getTunnelBaseHost()}`;
}

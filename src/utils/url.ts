/**
 * Utility functions for generating URLs
 */

/**
 * Get the base URL for the Runloop platform based on environment
 * - dev: https://platform.runloop.pro
 * - prod or unset: https://platform.runloop.ai (default)
 */
export function getBaseUrl(): string {
  const env = process.env.RUNLOOP_ENV?.toLowerCase();

  switch (env) {
    case 'dev':
      return 'https://platform.runloop.pro';
    case 'prod':
    default:
      return 'https://platform.runloop.ai';
  }
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

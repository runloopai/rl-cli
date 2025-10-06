/**
 * Utility functions for generating URLs
 */

/**
 * Get the base URL for the Runloop platform based on environment
 */
export function getBaseUrl(): string {
  const baseUrl = process.env.RUNLOOP_BASE_URL;
  
  // If RUNLOOP_BASE_URL is explicitly set, use it
  if (baseUrl) {
    return baseUrl;
  }
  
  // Default to production
  return 'https://platform.runloop.ai';
}

/**
 * Generate a devbox URL for the given devbox ID
 */
export function getDevboxUrl(devboxId: string): string {
  const baseUrl = getBaseUrl();
  
  // If it's not production, use runloop.pro
  if (baseUrl !== 'https://platform.runloop.ai') {
    return `https://platform.runloop.pro/devboxes/${devboxId}`;
  }
  
  return `https://platform.runloop.ai/devboxes/${devboxId}`;
}

/**
 * Generate a blueprint URL for the given blueprint ID
 */
export function getBlueprintUrl(blueprintId: string): string {
  const baseUrl = getBaseUrl();
  
  // If it's not production, use runloop.pro
  if (baseUrl !== 'https://platform.runloop.ai') {
    return `https://platform.runloop.pro/blueprints/${blueprintId}`;
  }
  
  return `https://platform.runloop.ai/blueprints/${blueprintId}`;
}

/**
 * Generate a settings URL
 */
export function getSettingsUrl(): string {
  const baseUrl = getBaseUrl();
  
  // If it's not production, use runloop.pro
  if (baseUrl !== 'https://platform.runloop.ai') {
    return 'https://platform.runloop.pro/settings';
  }
  
  return 'https://platform.runloop.ai/settings';
}

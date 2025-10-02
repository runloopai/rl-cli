import Runloop from '@runloop/api-client';
import { getConfig } from './config.js';

export function getClient(): Runloop {
  const config = getConfig();

  if (!config.apiKey) {
    throw new Error('API key not configured. Run: rln auth');
  }

  return new Runloop({
    bearerToken: config.apiKey,
    timeout: 10000, // 10 seconds instead of default 30 seconds
    maxRetries: 2,  // 2 retries instead of default 5 (only for retryable errors)
  });
}

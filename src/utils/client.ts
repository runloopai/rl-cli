import Runloop from '@runloop/api-client';
import { getConfig } from './config.js';

export function getClient(): Runloop {
  const config = getConfig();

  if (!config.apiKey) {
    throw new Error('API key not configured. Run: rln auth');
  }

  return new Runloop({
    bearerToken: config.apiKey,
  });
}

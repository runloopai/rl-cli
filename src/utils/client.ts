import { Runloop } from "@runloop/api-client";
import { VERSION } from "@runloop/api-client/version.js";
import { getConfig, baseUrl as getApiBaseUrl } from "./config.js";

export function getClient(): Runloop {
  const config = getConfig();

  if (!config.apiKey) {
    throw new Error(
      "API key not configured. Set RUNLOOP_API_KEY environment variable.",
    );
  }

  const baseURL = getApiBaseUrl();

  return new Runloop({
    bearerToken: config.apiKey,
    baseURL,
    defaultHeaders: {
      "User-Agent": `Runloop/JS - CLI ${VERSION}`,
    },
  });
}

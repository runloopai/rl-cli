import Runloop from "@runloop/api-client";
import { VERSION } from "@runloop/api-client/version.js";
import { getConfig } from "./config.js";

/**
 * Get the base URL based on RUNLOOP_ENV environment variable
 * - dev: https://api.runloop.pro
 * - prod or unset: https://api.runloop.ai (default)
 */
function getBaseUrl(): string {
  const env = process.env.RUNLOOP_ENV?.toLowerCase();

  switch (env) {
    case "dev":
      return "https://api.runloop.pro";
    case "prod":
    default:
      return "https://api.runloop.ai";
  }
}

export function getClient(): Runloop {
  const config = getConfig();

  if (!config.apiKey) {
    throw new Error("API key not configured. Run: rli auth");
  }

  const baseURL = getBaseUrl();

  return new Runloop({
    bearerToken: config.apiKey,
    baseURL,
    defaultHeaders: {
      "User-Agent": `Runloop/JS ${VERSION} - CLI`,
    },
  });
}

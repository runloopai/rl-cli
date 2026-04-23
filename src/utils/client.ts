import { Runloop } from "@runloop/api-client";
import { VERSION } from "@runloop/api-client/version.js";
import { getConfig } from "./config.js";

export function getClient(): Runloop {
  const config = getConfig();

  if (!config.apiKey) {
    throw new Error(
      "API key not configured. Set RUNLOOP_API_KEY environment variable.",
    );
  }

  return new Runloop({
    bearerToken: config.apiKey,
    defaultHeaders: {
      "User-Agent": `Runloop/JS - CLI ${VERSION}`,
    },
  });
}

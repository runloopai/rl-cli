/**
 * Create gateway config command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface CreateOptions {
  name: string;
  endpoint: string;
  bearerAuth?: boolean;
  headerAuth?: string;
  description?: string;
  output?: string;
}

export async function createGatewayConfig(options: CreateOptions) {
  try {
    const client = getClient();

    // Validate that exactly one auth type is specified
    if (options.bearerAuth && options.headerAuth) {
      outputError(
        "Cannot specify both --bearer-auth and --header-auth. Choose one.",
      );
      return;
    }

    // Default to bearer if neither is specified
    const authType = options.headerAuth ? "header" : "bearer";

    // Build auth mechanism
    const authMechanism: { type: string; key?: string } = {
      type: authType,
    };
    if (authType === "header" && options.headerAuth) {
      authMechanism.key = options.headerAuth;
    }

    const config = await client.gatewayConfigs.create({
      name: options.name,
      endpoint: options.endpoint,
      auth_mechanism: authMechanism,
      description: options.description,
    });

    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      console.log(config.id);
    } else {
      output(config, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to create gateway config", error);
  }
}

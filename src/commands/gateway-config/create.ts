/**
 * Create gateway config command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface CreateOptions {
  name: string;
  endpoint: string;
  authType: string;
  authKey?: string;
  description?: string;
  output?: string;
}

export async function createGatewayConfig(options: CreateOptions) {
  try {
    const client = getClient();

    // Validate auth type
    const authType = options.authType.toLowerCase();
    if (authType !== "bearer" && authType !== "header") {
      outputError("Invalid auth type. Must be 'bearer' or 'header'");
      return;
    }

    // Validate auth key is provided for header type
    if (authType === "header" && !options.authKey) {
      outputError("--auth-key is required when auth-type is 'header'");
      return;
    }

    // Build auth mechanism
    const authMechanism: { type: string; key?: string } = {
      type: authType,
    };
    if (authType === "header" && options.authKey) {
      authMechanism.key = options.authKey;
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

/**
 * Update gateway config command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface UpdateOptions {
  id: string;
  name?: string;
  endpoint?: string;
  authType?: string;
  authKey?: string;
  description?: string;
  output?: string;
}

export async function updateGatewayConfig(options: UpdateOptions) {
  try {
    const client = getClient();

    // Build update params - only include fields that are provided
    const updateParams: Record<string, unknown> = {};

    if (options.name) {
      updateParams.name = options.name;
    }
    if (options.endpoint) {
      updateParams.endpoint = options.endpoint;
    }
    if (options.description !== undefined) {
      updateParams.description = options.description;
    }

    // Handle auth mechanism update
    if (options.authType) {
      const authType = options.authType.toLowerCase();
      if (authType !== "bearer" && authType !== "header") {
        outputError("Invalid auth type. Must be 'bearer' or 'header'");
        return;
      }

      const authMechanism: { type: string; key?: string } = {
        type: authType,
      };
      if (authType === "header") {
        if (!options.authKey) {
          outputError("--auth-key is required when auth-type is 'header'");
          return;
        }
        authMechanism.key = options.authKey;
      }
      updateParams.auth_mechanism = authMechanism;
    } else if (options.authKey) {
      // If only auth key is provided without auth type, we need the type
      outputError("--auth-type is required when updating --auth-key");
      return;
    }

    if (Object.keys(updateParams).length === 0) {
      outputError("No update options provided. Use --name, --endpoint, --auth-type, --auth-key, or --description");
      return;
    }

    const config = await client.gatewayConfigs.update(
      options.id,
      updateParams as Parameters<typeof client.gatewayConfigs.update>[1],
    );

    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      console.log(config.id);
    } else {
      output(config, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to update gateway config", error);
  }
}

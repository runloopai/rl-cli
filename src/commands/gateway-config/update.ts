/**
 * Update gateway config command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface UpdateOptions {
  id: string;
  name?: string;
  endpoint?: string;
  bearerAuth?: boolean;
  headerAuth?: string;
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

    // Validate that at most one auth type is specified
    if (options.bearerAuth && options.headerAuth) {
      outputError(
        "Cannot specify both --bearer-auth and --header-auth. Choose one.",
      );
      return;
    }

    // Handle auth mechanism update
    if (options.bearerAuth) {
      updateParams.auth_mechanism = { type: "bearer" };
    } else if (options.headerAuth) {
      updateParams.auth_mechanism = {
        type: "header",
        key: options.headerAuth,
      };
    }

    if (Object.keys(updateParams).length === 0) {
      outputError(
        "No update options provided. Use --name, --endpoint, --bearer-auth, --header-auth, or --description",
      );
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

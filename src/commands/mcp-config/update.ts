/**
 * Update MCP config command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { validateMcpConfig } from "../../utils/mcpConfigValidation.js";

interface UpdateOptions {
  id: string;
  name?: string;
  endpoint?: string;
  allowedTools?: string;
  description?: string;
  output?: string;
}

export async function updateMcpConfig(options: UpdateOptions) {
  try {
    const client = getClient();

    const validation = validateMcpConfig(
      {
        name: options.name,
        endpoint: options.endpoint,
        allowedTools: options.allowedTools,
      },
      {
        requireName: false,
        requireEndpoint: false,
        requireAllowedTools: false,
      },
    );

    if (!validation.valid) {
      outputError(validation.errors.join("\n"));
      return;
    }

    const { sanitized } = validation;

    const updateParams: Record<string, unknown> = {};

    if (sanitized!.name) {
      updateParams.name = sanitized!.name;
    }
    if (sanitized!.endpoint) {
      updateParams.endpoint = sanitized!.endpoint;
    }
    if (sanitized!.allowedTools) {
      updateParams.allowed_tools = sanitized!.allowedTools;
    }
    if (options.description !== undefined) {
      updateParams.description = options.description.trim() || undefined;
    }

    if (Object.keys(updateParams).length === 0) {
      outputError(
        "No update options provided. Use --name, --endpoint, --allowed-tools, or --description",
      );
      return;
    }

    const config = await client.mcpConfigs.update(
      options.id,
      updateParams as Parameters<typeof client.mcpConfigs.update>[1],
    );

    if (!options.output || options.output === "text") {
      console.log(config.id);
    } else {
      output(config, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to update MCP config", error);
  }
}

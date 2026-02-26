/**
 * Create MCP config command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { validateMcpConfig } from "../../utils/mcpConfigValidation.js";

interface CreateOptions {
  name: string;
  endpoint: string;
  allowedTools: string;
  description?: string;
  output?: string;
}

export async function createMcpConfig(options: CreateOptions) {
  try {
    const client = getClient();

    const validation = validateMcpConfig(
      {
        name: options.name,
        endpoint: options.endpoint,
        allowedTools: options.allowedTools,
      },
      { requireName: true, requireEndpoint: true, requireAllowedTools: true },
    );

    if (!validation.valid) {
      outputError(validation.errors.join("\n"));
      return;
    }

    const { sanitized } = validation;

    const config = await client.mcpConfigs.create({
      name: sanitized!.name!,
      endpoint: sanitized!.endpoint!,
      allowed_tools: sanitized!.allowedTools!,
      description: options.description?.trim() || undefined,
    });

    if (!options.output || options.output === "text") {
      console.log(config.id);
    } else {
      output(config, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to create MCP config", error);
  }
}

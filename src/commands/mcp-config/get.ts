/**
 * Get MCP config command - supports lookup by ID or name
 */

import { getMcpConfigByIdOrName } from "../../services/mcpConfigService.js";
import { output, outputError } from "../../utils/output.js";

interface GetOptions {
  id: string;
  output?: string;
}

export async function getMcpConfig(options: GetOptions) {
  try {
    const config = await getMcpConfigByIdOrName(options.id);

    if (!config) {
      outputError(`MCP config not found: ${options.id}`);
      return;
    }

    output(config, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get MCP config", error);
  }
}

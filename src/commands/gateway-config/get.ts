/**
 * Get gateway config command - supports lookup by ID or name
 */

import { getGatewayConfigByIdOrName } from "../../services/gatewayConfigService.js";
import { output, outputError } from "../../utils/output.js";

interface GetOptions {
  id: string;
  output?: string;
}

export async function getGatewayConfig(options: GetOptions) {
  try {
    const config = await getGatewayConfigByIdOrName(options.id);

    if (!config) {
      outputError(`Gateway config not found: ${options.id}`);
      return;
    }

    output(config, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get gateway config", error);
  }
}

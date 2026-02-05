/**
 * Get gateway config command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface GetOptions {
  id: string;
  output?: string;
}

export async function getGatewayConfig(options: GetOptions) {
  try {
    const client = getClient();

    const config = await client.gatewayConfigs.retrieve(options.id);

    output(config, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get gateway config", error);
  }
}

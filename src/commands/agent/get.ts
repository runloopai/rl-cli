/**
 * Get agent details command
 */

import { getAgent } from "../../services/agentService.js";
import { output, outputError } from "../../utils/output.js";

interface GetAgentOptions {
  id: string;
  output?: string;
}

export async function getAgentCommand(options: GetAgentOptions) {
  try {
    const agent = await getAgent(options.id);
    output(agent, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get agent", error);
  }
}

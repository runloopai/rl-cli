/**
 * Show agent details command
 */

import {
  getAgent,
  listAgents,
  type Agent,
} from "../../services/agentService.js";
import { output, outputError } from "../../utils/output.js";

interface ShowOptions {
  output?: string;
}

/**
 * Determine whether the input looks like an agent ID (starts with "agt_")
 * vs. a name, then retrieve the corresponding agent.
 */
async function resolveAgent(idOrName: string): Promise<Agent> {
  if (idOrName.startsWith("agt_")) {
    return getAgent(idOrName);
  }

  // Look up by name — fetch all versions with this name and pick the latest.
  const result = await listAgents({ name: idOrName });
  const matches = result.agents.filter((a) => a.name === idOrName);
  if (matches.length === 0) {
    throw new Error(`No agent found with name: ${idOrName}`);
  }

  // Pick the most recently created version
  matches.sort((a, b) => b.create_time_ms - a.create_time_ms);
  return matches[0];
}

export async function showAgentCommand(
  idOrName: string,
  options: ShowOptions,
): Promise<void> {
  try {
    const agent = await resolveAgent(idOrName);
    output(agent, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get agent", error);
  }
}

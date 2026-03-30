/**
 * List agents command
 */

import { listAgents } from "../../services/agentService.js";
import { output, outputError, parseLimit } from "../../utils/output.js";

interface ListAgentsCommandOptions {
  limit?: string;
  name?: string;
  search?: string;
  public?: boolean;
  private?: boolean;
  output?: string;
}

export async function listAgentsCommand(options: ListAgentsCommandOptions) {
  try {
    const result = await listAgents({
      limit: parseLimit(options.limit),
      name: options.name,
      search: options.search,
      publicOnly: options.public,
      privateOnly: options.private,
    });

    output(result.agents, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list agents", error);
  }
}

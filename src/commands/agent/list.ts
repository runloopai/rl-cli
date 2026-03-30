/**
 * List agents command
 */

import chalk from "chalk";
import { listAgents, type Agent } from "../../services/agentService.js";
import { output, outputError } from "../../utils/output.js";
import { formatTimeAgo } from "../../utils/time.js";

interface ListOptions {
  full?: boolean;
  name?: string;
  search?: string;
  public?: boolean;
  private?: boolean;
  output?: string;
}

// Column widths (NAME is dynamic, takes remaining space)
const COL_VERSION = 14;
const COL_VISIBILITY = 10;
const COL_ID = 30;
const COL_CREATED = 10;
const FIXED_WIDTH = COL_VERSION + COL_VISIBILITY + COL_ID + COL_CREATED + 4; // 4 for spacing

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

function printTable(agents: Agent[]): void {
  if (agents.length === 0) {
    console.log(chalk.dim("No agents found"));
    return;
  }

  const termWidth = process.stdout.columns || 120;
  const nameWidth = Math.max(10, termWidth - FIXED_WIDTH);

  // Header
  const header =
    "NAME".padEnd(nameWidth) +
    " " +
    "VERSION".padEnd(COL_VERSION) +
    " " +
    "VISIBILITY".padEnd(COL_VISIBILITY) +
    " " +
    "ID".padEnd(COL_ID) +
    " " +
    "CREATED".padEnd(COL_CREATED);
  console.log(chalk.bold(header));
  console.log(chalk.dim("─".repeat(Math.min(header.length, termWidth))));

  for (const agent of agents) {
    const name = truncate(agent.name, nameWidth).padEnd(nameWidth);
    const version = truncate(agent.version, COL_VERSION).padEnd(COL_VERSION);
    const visibility = (agent.is_public ? "public" : "private").padEnd(
      COL_VISIBILITY,
    );
    const visibilityColored = agent.is_public
      ? chalk.green(visibility)
      : chalk.dim(visibility);
    const id = truncate(agent.id, COL_ID).padEnd(COL_ID);
    const created = formatTimeAgo(agent.create_time_ms).padEnd(COL_CREATED);

    console.log(
      `${name} ${version} ${visibilityColored} ${chalk.dim(id)} ${chalk.dim(created)}`,
    );
  }

  console.log();
  console.log(
    chalk.dim(`${agents.length} agent${agents.length !== 1 ? "s" : ""}`),
  );
}

/**
 * Keep only the most recently created agent for each name.
 */
function keepLatestPerName(agents: Agent[]): Agent[] {
  const latestByName = new Map<string, Agent>();
  for (const agent of agents) {
    const existing = latestByName.get(agent.name);
    if (!existing || agent.create_time_ms > existing.create_time_ms) {
      latestByName.set(agent.name, agent);
    }
  }
  return Array.from(latestByName.values());
}

export async function listAgentsCommand(options: ListOptions): Promise<void> {
  try {
    const result = await listAgents({
      publicOnly: options.public,
      privateOnly: options.private,
      name: options.name,
      search: options.search,
    });

    const agents = options.full
      ? result.agents
      : keepLatestPerName(result.agents);

    const format = options.output || "text";
    if (format !== "text") {
      output(agents, { format, defaultFormat: "json" });
    } else {
      printTable(agents);
    }
  } catch (error) {
    outputError("Failed to list agents", error);
  }
}

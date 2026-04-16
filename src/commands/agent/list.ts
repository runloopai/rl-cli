/**
 * List agents command
 */

import chalk from "chalk";
import {
  listAgents,
  getAgentColumns,
  type Agent,
} from "../../services/agentService.js";
import { output, outputError } from "../../utils/output.js";

interface ListOptions {
  full?: boolean;
  name?: string;
  search?: string;
  public?: boolean;
  private?: boolean;
  output?: string;
}

/** Styling rules keyed by column key. Columns not listed render unstyled. */
const columnStyle: Record<string, (raw: string) => string> = {
  id: (v) => chalk.dim(v),
  created: (v) => chalk.dim(v),
  version: (v) => {
    // Dim the "pkg@" prefix when present. Use lastIndexOf to skip scoped package @ (e.g. @scope/pkg@1.0)
    const at = v.lastIndexOf("@");
    return at > 0 ? chalk.dim(v.slice(0, at + 1)) + v.slice(at + 1) : v;
  },
};

function padStyled(raw: string, styled: string, width: number): string {
  return styled + " ".repeat(Math.max(0, width - raw.length));
}

/**
 * Render a table of agents to stdout. Reusable by other commands.
 */
export function printAgentTable(agents: Agent[]): void {
  if (agents.length === 0) {
    console.log(chalk.dim("No agents found"));
    return;
  }

  const termWidth = process.stdout.columns || 120;
  const columns = getAgentColumns(agents, termWidth);

  // Header
  const header = columns.map((col) => col.label.padEnd(col.width)).join("");
  console.log(chalk.bold(header));
  console.log(chalk.dim("─".repeat(Math.min(header.length, termWidth))));

  // Rows
  for (const agent of agents) {
    const line = columns
      .map((col) => {
        const raw = col.getValue(agent);
        const styleFn = columnStyle[col.key];
        const styled = styleFn ? styleFn(raw) : raw;
        return padStyled(raw, styled, col.width);
      })
      .join("");
    console.log(line);
  }

  console.log();
  console.log(
    chalk.dim(`${agents.length} agent${agents.length !== 1 ? "s" : ""}`),
  );
}

function printTable(agents: Agent[], isPublic: boolean): void {
  if (isPublic) {
    console.log(
      chalk.dim("Showing PUBLIC agents. Use --private to see private agents"),
    );
  } else {
    console.log(
      chalk.dim("Showing PRIVATE agents. Use --public to see public agents"),
    );
  }
  console.log();

  printAgentTable(agents);
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
      printTable(agents, !!options.public);
    }
  } catch (error) {
    outputError("Failed to list agents", error);
  }
}

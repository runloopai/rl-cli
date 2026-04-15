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

interface ColumnDef {
  header: string;
  raw: (agent: Agent) => string;
  styled: (agent: Agent) => string;
}

const columns: ColumnDef[] = [
  {
    header: "NAME",
    raw: (a) => a.name,
    styled(a) {
      return this.raw(a);
    },
  },
  {
    header: "SOURCE",
    raw: (a) => (a as any).source?.type || "-",
    styled(a) {
      return this.raw(a);
    },
  },
  {
    header: "VERSION",
    raw: (a) => {
      const pkg =
        (a as any).source?.npm?.package_name ||
        (a as any).source?.pip?.package_name;
      return pkg ? `${pkg}@${a.version}` : a.version;
    },
    styled(a) {
      const pkg =
        (a as any).source?.npm?.package_name ||
        (a as any).source?.pip?.package_name;
      return pkg ? chalk.dim(pkg + "@") + a.version : a.version;
    },
  },
  {
    header: "ID",
    raw: (a) => a.id,
    styled(a) {
      return chalk.dim(a.id);
    },
  },
  {
    header: "CREATED",
    raw: (a) => formatTimeAgo(a.create_time_ms),
    styled(a) {
      return chalk.dim(this.raw(a));
    },
  },
];

function computeColumnWidths(agents: Agent[]): number[] {
  const minPad = 2;
  const maxPad = 4;
  const termWidth = process.stdout.columns || 120;

  // Min width per column: max of header and all row values, plus minimum padding
  const minWidths = columns.map((col) => {
    const maxContent = agents.reduce(
      (w, a) => Math.max(w, col.raw(a).length),
      col.header.length,
    );
    return maxContent + minPad;
  });

  const totalMin = minWidths.reduce((s, w) => s + w, 0);
  const slack = termWidth - totalMin;
  const extraPerCol = Math.min(
    maxPad - minPad,
    Math.max(0, Math.floor(slack / columns.length)),
  );

  return minWidths.map((w) => w + extraPerCol);
}

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

  const widths = computeColumnWidths(agents);
  const termWidth = process.stdout.columns || 120;

  // Header
  const header = columns.map((col, i) => col.header.padEnd(widths[i])).join("");
  console.log(chalk.bold(header));
  console.log(chalk.dim("─".repeat(Math.min(header.length, termWidth))));

  // Rows
  for (const agent of agents) {
    const line = columns
      .map((col, i) => padStyled(col.raw(agent), col.styled(agent), widths[i]))
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

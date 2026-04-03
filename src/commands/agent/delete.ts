/**
 * Delete agent command
 */
import chalk from "chalk";
import readline from "readline";
import {
  getAgent,
  listAgents,
  deleteAgent,
} from "../../services/agentService.js";
import { output, outputError } from "../../utils/output.js";

interface DeleteOptions {
  yes?: boolean;
  output?: string;
}

async function resolveAgentId(idOrName: string): Promise<string> {
  if (idOrName.startsWith("agt_")) {
    return idOrName;
  }

  const result = await listAgents({ name: idOrName });
  const matches = result.agents.filter((a) => a.name === idOrName);
  if (matches.length === 0) {
    throw new Error(`No agent found with name: ${idOrName}`);
  }
  matches.sort((a, b) => b.create_time_ms - a.create_time_ms);
  return matches[0].id;
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

export async function deleteAgentCommand(
  idOrName: string,
  options: DeleteOptions,
): Promise<void> {
  try {
    const agentId = await resolveAgentId(idOrName);
    const agent = await getAgent(agentId);

    if (!options.yes) {
      const confirmed = await confirm(
        `Delete agent "${agent.name}" (${agent.id})? [y/N] `,
      );
      if (!confirmed) {
        console.log(chalk.dim("Cancelled"));
        return;
      }
    }

    await deleteAgent(agentId);

    const format = options.output || "text";
    if (format !== "text") {
      output(
        { deleted: true, id: agentId, name: agent.name },
        { format, defaultFormat: "json" },
      );
    } else {
      console.log(chalk.green("✓") + ` Agent "${agent.name}" deleted`);
    }
  } catch (error) {
    outputError("Failed to delete agent", error);
  }
}

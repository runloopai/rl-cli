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
import { printAgentTable } from "./list.js";
import { output, outputError } from "../../utils/output.js";

interface DeleteOptions {
  yes?: boolean;
  output?: string;
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
    // Direct ID lookup
    if (idOrName.startsWith("agt_")) {
      const agent = await getAgent(idOrName);
      await confirmAndDelete(agent, options);
      return;
    }

    // Name lookup — require exactly one match
    const result = await listAgents({ name: idOrName });
    const matches = result.agents.filter((a) => a.name === idOrName);

    if (matches.length === 0) {
      throw new Error(`No agent found with name: ${idOrName}`);
    }

    if (matches.length > 1) {
      console.log(
        `Multiple agents found with name "${idOrName}". Delete by ID instead:`,
      );
      console.log();
      printAgentTable(matches);
      return;
    }

    await confirmAndDelete(matches[0], options);
  } catch (error) {
    outputError("Failed to delete agent", error);
  }
}

async function confirmAndDelete(
  agent: { id: string; name: string },
  options: DeleteOptions,
): Promise<void> {
  if (!options.yes) {
    const confirmed = await confirm(
      `Delete agent "${agent.name}" (${agent.id})? [y/N] `,
    );
    if (!confirmed) {
      console.log(chalk.dim("Cancelled"));
      return;
    }
  }

  await deleteAgent(agent.id);

  const format = options.output || "text";
  if (format !== "text") {
    output(
      { deleted: true, id: agent.id, name: agent.name },
      { format, defaultFormat: "json" },
    );
  } else {
    console.log(chalk.green("✓") + ` Agent "${agent.name}" (${agent.id}) deleted`);
  }
}

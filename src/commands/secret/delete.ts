/**
 * Delete secret command
 */

import * as readline from "readline";
import { getClient } from "../../utils/client.js";
import { output } from "../../utils/output.js";

interface DeleteOptions {
  yes?: boolean;
  output?: string;
}

/**
 * Prompt for confirmation
 */
async function confirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

export async function deleteSecret(name: string, options: DeleteOptions = {}) {
  try {
    const client = getClient();

    // Confirm deletion unless --yes flag is passed
    if (!options.yes) {
      const confirmed = await confirm(
        `Are you sure you want to delete secret "${name}"?`,
      );
      if (!confirmed) {
        console.log("Aborted.");
        return;
      }
    }

    // Delete by name
    const secret = await client.secrets.delete(name);

    // Default: show confirmation message
    if (!options.output || options.output === "text") {
      console.log(`Deleted secret "${name}" (${secret.id})`);
    } else {
      output(
        { id: secret.id, name, status: "deleted" },
        { format: options.output, defaultFormat: "json" },
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
      console.error(`Error: Secret "${name}" not found`);
    } else {
      console.error(`Error: Failed to delete secret`);
      console.error(`  ${errorMessage}`);
    }
    process.exit(1);
  }
}

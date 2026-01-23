/**
 * Delete secret command
 */

import * as readline from "readline";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

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

    const client = getClient();
    const secret = await client.secrets.delete(name);

    // Default: just output the name for easy scripting
    if (!options.output || options.output === "text") {
      console.log(name);
    } else {
      output(
        { id: secret.id, name, status: "deleted" },
        { format: options.output, defaultFormat: "json" },
      );
    }
  } catch (error) {
    outputError("Failed to delete secret", error);
  }
}

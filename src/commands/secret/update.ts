/**
 * Update secret command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { getSecretValue } from "../../utils/stdin.js";

interface UpdateOptions {
  output?: string;
}

export async function updateSecret(name: string, options: UpdateOptions = {}) {
  try {
    // Get new secret value from stdin (piped) or interactive prompt
    const value = await getSecretValue();

    if (!value) {
      outputError("Secret value cannot be empty", new Error("Empty value"));
    }

    const client = getClient();
    const secret = await client.secrets.update(name, { value });

    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      console.log(secret.id);
    } else {
      output(secret, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to update secret", error);
  }
}

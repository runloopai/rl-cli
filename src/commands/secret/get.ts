/**
 * Get secret metadata command
 *
 * Note: The API doesn't have a direct "get by name" endpoint,
 * so we list all secrets and filter by name.
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface GetOptions {
  output?: string;
}

export async function getSecret(name: string, options: GetOptions = {}) {
  try {
    const client = getClient();

    // List all secrets and find by name
    const result = await client.secrets.list({ limit: 5000 });
    const secret = result.secrets?.find((s) => s.name === name);

    if (!secret) {
      outputError(
        `Secret "${name}" not found`,
        new Error("Secret not found"),
      );
    }

    output(secret, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get secret", error);
  }
}

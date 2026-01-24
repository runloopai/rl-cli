/**
 * List secrets command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface ListOptions {
  limit?: string;
  output?: string;
}

const DEFAULT_PAGE_SIZE = 20;

export async function listSecrets(options: ListOptions = {}) {
  try {
    const client = getClient();

    const limit = options.limit
      ? parseInt(options.limit, 10)
      : DEFAULT_PAGE_SIZE;

    // Fetch secrets
    const result = await client.secrets.list({ limit });

    // Extract secrets array
    const secrets = result.secrets || [];

    // Default: output JSON for lists
    output(secrets, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list secrets", error);
  }
}

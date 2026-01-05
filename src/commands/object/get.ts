/**
 * Get object details command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface GetObjectOptions {
  id: string;
  output?: string;
}

export async function getObject(options: GetObjectOptions) {
  try {
    const client = getClient();
    const object = await client.objects.retrieve(options.id);
    output(object, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get object", error);
  }
}


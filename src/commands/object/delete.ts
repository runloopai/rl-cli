/**
 * Delete object command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface DeleteObjectOptions {
  id: string;
  output?: string;
}

export async function deleteObject(options: DeleteObjectOptions) {
  try {
    const client = getClient();
    const deletedObject = await client.objects.delete(options.id);
    output(deletedObject, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to delete object", error);
  }
}


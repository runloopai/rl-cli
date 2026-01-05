/**
 * List objects command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface ListObjectsOptions {
  limit?: number;
  startingAfter?: string;
  name?: string;
  contentType?: string;
  state?: string;
  search?: string;
  public?: boolean;
  output?: string;
}

export async function listObjects(options: ListObjectsOptions = {}) {
  try {
    const client = getClient();
    
    // Build params
    const params: Record<string, unknown> = {};
    if (options.limit) params.limit = options.limit;
    if (options.startingAfter) params.startingAfter = options.startingAfter;
    if (options.name) params.name = options.name;
    if (options.contentType) params.contentType = options.contentType;
    if (options.state) params.state = options.state;
    if (options.search) params.search = options.search;
    if (options.public) params.isPublic = true;
    
    const result = options.public
      ? await client.objects.listPublic(params)
      : await client.objects.list(params);
    
    const objects = result.objects || [];
    
    output(objects, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to list objects", error);
  }
}


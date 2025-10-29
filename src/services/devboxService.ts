/**
 * Devbox Service - Handles all devbox API calls
 * Returns plain data objects with no SDK reference retention
 */
import { getClient } from "../utils/client.js";
import type { Devbox } from "../store/devboxStore.js";
import type { DevboxesCursorIDPage } from "@runloop/api-client/pagination";

/**
 * Recursively truncate all strings in an object to prevent Yoga crashes
 * CRITICAL: Must be applied to ALL data from API before storing/rendering
 */
function truncateStrings(obj: any, maxLength: number = 200): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return obj.length > maxLength ? obj.substring(0, maxLength) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => truncateStrings(item, maxLength));
  }

  if (typeof obj === "object") {
    const result: any = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        result[key] = truncateStrings(obj[key], maxLength);
      }
    }
    return result;
  }

  return obj;
}

export interface ListDevboxesOptions {
  limit: number;
  startingAfter?: string;
  status?: string;
  search?: string;
  signal?: AbortSignal;
}

export interface ListDevboxesResult {
  devboxes: Devbox[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * List devboxes with pagination
 * CRITICAL: Creates defensive copies to break SDK reference chains
 */
export async function listDevboxes(
  options: ListDevboxesOptions,
): Promise<ListDevboxesResult> {
  // Check if aborted before making request
  if (options.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const client = getClient();

  const queryParams: any = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }
  if (options.status) {
    queryParams.status = options.status;
  }
  if (options.search) {
    queryParams.search = options.search;
  }

  // Fetch ONE page only - never iterate
  const pagePromise = client.devboxes.list(queryParams);

  // Wrap in Promise.race to support abort
  let page: DevboxesCursorIDPage<{ id: string }>;
  if (options.signal) {
    const abortPromise = new Promise<never>((_, reject) => {
      options.signal!.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
    try {
      page = (await Promise.race([
        pagePromise,
        abortPromise,
      ])) as DevboxesCursorIDPage<{ id: string }>;
    } catch (err) {
      // Re-throw abort errors, convert others
      if ((err as Error)?.name === "AbortError") {
        throw err;
      }
      throw err;
    }
  } else {
    page = (await pagePromise) as DevboxesCursorIDPage<{ id: string }>;
  }

  // Check again after await (in case abort happened during request)
  if (options.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  // Extract data and create defensive copies immediately
  const devboxes: Devbox[] = [];

  if (page.devboxes && Array.isArray(page.devboxes)) {
    page.devboxes.forEach((d: any) => {
      // CRITICAL: Recursively truncate ALL strings in the object to prevent Yoga crashes
      // This catches nested fields like launch_parameters.user_parameters.username
      const truncated = truncateStrings(d, 200);
      devboxes.push(truncated as Devbox);
    });
  }

  const result = {
    devboxes,
    totalCount: page.total_count || devboxes.length,
    hasMore: page.has_more || false,
  };

  // CRITICAL: Null out page reference to help GC
  page = null as any;

  return result;
}

/**
 * Get a single devbox by ID
 */
export async function getDevbox(id: string): Promise<Devbox> {
  const client = getClient();
  const devbox = await client.devboxes.retrieve(id);

  // CRITICAL: Recursively truncate ALL strings in the object to prevent Yoga crashes
  return truncateStrings(devbox, 200) as Devbox;
}

/**
 * Delete a devbox (actually shuts it down)
 */
export async function deleteDevbox(id: string): Promise<void> {
  const client = getClient();
  await client.devboxes.shutdown(id);
}

/**
 * Shutdown a devbox
 */
export async function shutdownDevbox(id: string): Promise<void> {
  const client = getClient();
  await client.devboxes.shutdown(id);
}

/**
 * Suspend a devbox
 */
export async function suspendDevbox(id: string): Promise<void> {
  const client = getClient();
  await client.devboxes.suspend(id);
}

/**
 * Resume a devbox
 */
export async function resumeDevbox(id: string): Promise<void> {
  const client = getClient();
  await client.devboxes.resume(id);
}

/**
 * Upload file to devbox
 */
export async function uploadFile(
  id: string,
  filepath: string,
  remotePath: string,
): Promise<void> {
  const client = getClient();
  const fs = await import("fs");
  const fileStream = fs.createReadStream(filepath);

  await client.devboxes.uploadFile(id, {
    file: fileStream as any,
    path: remotePath,
  });
}

/**
 * Create snapshot of devbox
 */
export async function createSnapshot(
  id: string,
  name?: string,
): Promise<{ id: string; name?: string }> {
  const client = getClient();
  const snapshot = await client.devboxes.snapshotDisk(id, { name });

  return {
    id: String(snapshot.id || "").substring(0, 100),
    name: snapshot.name ? String(snapshot.name).substring(0, 200) : undefined,
  };
}

/**
 * Create SSH key for devbox
 */
export async function createSSHKey(id: string): Promise<{
  ssh_private_key: string;
  url: string;
}> {
  const client = getClient();
  const result = await client.devboxes.createSSHKey(id);

  // Truncate keys if they're unexpectedly long (shouldn't happen, but safety)
  return {
    ssh_private_key: String(result.ssh_private_key || "").substring(0, 10000),
    url: String(result.url || "").substring(0, 500),
  };
}

/**
 * Create tunnel to devbox
 */
export async function createTunnel(
  id: string,
  port: number,
): Promise<{ url: string }> {
  const client = getClient();
  const tunnel = await client.devboxes.createTunnel(id, { port });

  return {
    url: String((tunnel as any).url || "").substring(0, 500),
  };
}

/**
 * Execute command in devbox
 */
export async function execCommand(
  id: string,
  command: string,
): Promise<{ stdout: string; stderr: string; exit_code: number }> {
  const client = getClient();
  const result = await client.devboxes.executeSync(id, { command });

  // CRITICAL: Truncate output to prevent Yoga crashes
  const MAX_OUTPUT_LENGTH = 10000; // Allow more for command output

  let stdout = String(result.stdout || "");
  let stderr = String(result.stderr || "");

  if (stdout.length > MAX_OUTPUT_LENGTH) {
    stdout =
      stdout.substring(0, MAX_OUTPUT_LENGTH) + "\n... (output truncated)";
  }
  if (stderr.length > MAX_OUTPUT_LENGTH) {
    stderr =
      stderr.substring(0, MAX_OUTPUT_LENGTH) + "\n... (output truncated)";
  }

  return {
    stdout,
    stderr,
    exit_code: (result as any).exit_code || 0,
  };
}

/**
 * Get devbox logs
 */
export async function getDevboxLogs(id: string): Promise<any[]> {
  const client = getClient();
  const response = await client.devboxes.logs.list(id);

  // CRITICAL: Truncate all strings to prevent Yoga crashes
  const MAX_MESSAGE_LENGTH = 1000; // Match component truncation
  const MAX_LEVEL_LENGTH = 20;

  // Extract logs and create defensive copies with truncated strings
  const logs: any[] = [];
  if (response.logs && Array.isArray(response.logs)) {
    response.logs.forEach((log: any) => {
      // Truncate message and escape newlines to prevent layout breaks
      let message = String(log.message || "");
      if (message.length > MAX_MESSAGE_LENGTH) {
        message = message.substring(0, MAX_MESSAGE_LENGTH) + "...";
      }
      // Escape newlines and special chars
      message = message
        .replace(/\r\n/g, "\\n")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");

      logs.push({
        timestamp: log.timestamp,
        message,
        level: log.level
          ? String(log.level).substring(0, MAX_LEVEL_LENGTH)
          : undefined,
      });
    });
  }

  return logs;
}

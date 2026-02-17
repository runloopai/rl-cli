/**
 * Devbox Service - Handles all devbox API calls
 * Returns plain data objects with no SDK reference retention
 */
import { getClient } from "../utils/client.js";
import type { Devbox } from "../store/devboxStore.js";
import type { DevboxesCursorIDPage } from "@runloop/api-client/pagination";
import type {
  DevboxAsyncExecutionDetailView,
  DevboxListParams,
  DevboxView,
} from "@runloop/api-client/resources/devboxes/devboxes";

/**
 * Recursively truncate all strings in an object to prevent Yoga crashes
 * CRITICAL: Must be applied to ALL data from API before storing/rendering
 */
function truncateStrings<T>(obj: T, maxLength: number = 200): T {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return (obj.length > maxLength ? obj.substring(0, maxLength) : obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => truncateStrings(item, maxLength)) as T;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        result[key] = truncateStrings(
          (obj as Record<string, unknown>)[key],
          maxLength,
        );
      }
    }
    return result as T;
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

  const queryParams: DevboxListParams & { name?: string } = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }
  if (options.status) {
    queryParams.status = options.status as DevboxListParams["status"];
  }
  if (options.search) {
    queryParams.name = options.search;
  }

  // Fetch ONE page only - never iterate
  const pagePromise = client.devboxes.list(queryParams);

  // Wrap in Promise.race to support abort
  let page: DevboxesCursorIDPage<DevboxView>;
  if (options.signal) {
    const abortPromise = new Promise<never>((_, reject) => {
      options.signal!.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
    try {
      page = await Promise.race([pagePromise, abortPromise]);
    } catch (err) {
      // Re-throw abort errors, convert others
      if ((err as Error)?.name === "AbortError") {
        throw err;
      }
      throw err;
    }
  } else {
    page = await pagePromise;
  }

  // Check again after await (in case abort happened during request)
  if (options.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  // Extract data and create defensive copies immediately
  const devboxes: Devbox[] = [];

  if (page.devboxes && Array.isArray(page.devboxes)) {
    page.devboxes.forEach((d: DevboxView) => {
      // CRITICAL: Recursively truncate ALL strings in the object to prevent Yoga crashes
      // This catches nested fields like launch_parameters.user_parameters.username
      const truncated = truncateStrings(d, 200);
      devboxes.push(truncated);
    });
  }

  const result = {
    devboxes,
    totalCount: page.total_count || devboxes.length,
    hasMore: page.has_more || false,
  };

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
    file: fileStream as Parameters<
      typeof client.devboxes.uploadFile
    >[1]["file"],
    path: remotePath,
  });
}

/**
 * Create snapshot of devbox
 */
export interface CreateSnapshotOptions {
  name?: string;
  metadata?: Record<string, string>;
  commit_message?: string;
}

export async function createSnapshot(
  id: string,
  options?: CreateSnapshotOptions,
): Promise<{ id: string; name?: string }> {
  const client = getClient();
  const params: {
    name?: string;
    metadata?: Record<string, string>;
    commit_message?: string;
  } = {};

  if (options?.name) {
    params.name = options.name;
  }
  if (options?.metadata && Object.keys(options.metadata).length > 0) {
    params.metadata = options.metadata;
  }
  if (options?.commit_message) {
    params.commit_message = options.commit_message;
  }

  const snapshot = await client.devboxes.snapshotDisk(id, params);

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
    url: String((tunnel as { url?: string }).url || "").substring(0, 500),
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
    exit_code: (result as { exit_code?: number }).exit_code ?? 0,
  };
}

/**
 * Get devbox logs
 * Returns the raw logs array from the API response
 */
export async function getDevboxLogs(
  id: string,
): Promise<import("../utils/logFormatter.js").DevboxLog[]> {
  const client = getClient();
  const response = await client.devboxes.logs.list(id);

  // Return the logs array directly - formatting is handled by logFormatter
  return response.logs || [];
}

/**
 * Execute command asynchronously in devbox
 * Used for both sync and async modes to enable kill/leave-early functionality
 */
export async function execCommandAsync(
  id: string,
  command: string,
): Promise<{ executionId: string; status: string }> {
  const client = getClient();
  const result = await client.devboxes.executions.executeAsync(id, { command });

  // Extract execution ID from result
  const r = result as { execution_id?: string; id?: string; status?: string };
  const executionId = r.execution_id ?? r.id ?? String(result);

  return {
    executionId: String(executionId).substring(0, 100),
    status: r.status ?? "running",
  };
}

/**
 * Get execution status and output
 * Used for polling in sync mode and checking status
 */
export async function getExecution(
  devboxId: string,
  executionId: string,
): Promise<DevboxAsyncExecutionDetailView> {
  const client = getClient();
  return client.devboxes.executions.retrieve(devboxId, executionId);
}

/**
 * Kill a running execution
 * Available in both sync and async modes
 */
export async function killExecution(
  devboxId: string,
  executionId: string,
): Promise<void> {
  const client = getClient();
  await client.devboxes.executions.kill(devboxId, executionId);
}

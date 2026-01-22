/**
 * Object Service - Handles all storage object API calls
 */
import { getClient } from "../utils/client.js";
import type { StorageObject } from "../store/objectStore.js";

export interface ListObjectsOptions {
  limit: number;
  startingAfter?: string;
  name?: string;
  contentType?: string;
  state?: string;
  isPublic?: boolean;
}

export interface ListObjectsResult {
  objects: StorageObject[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * List storage objects with pagination
 */
export async function listObjects(
  options: ListObjectsOptions,
): Promise<ListObjectsResult> {
  const client = getClient();

  const queryParams: Record<string, unknown> = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }
  if (options.name) {
    queryParams.name = options.name;
  }
  if (options.contentType) {
    queryParams.content_type = options.contentType;
  }
  if (options.state) {
    queryParams.state = options.state;
  }
  if (options.isPublic !== undefined) {
    queryParams.is_public = options.isPublic;
  }

  const result = await client.objects.list(queryParams);

  const objects: StorageObject[] = [];

  if (result.objects && Array.isArray(result.objects)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.objects.forEach((obj: any) => {
      // CRITICAL: Truncate all strings to prevent Yoga crashes
      const MAX_ID_LENGTH = 100;
      const MAX_NAME_LENGTH = 200;
      const MAX_CONTENT_TYPE_LENGTH = 100;
      const MAX_STATE_LENGTH = 50;

      objects.push({
        id: String(obj.id || "").substring(0, MAX_ID_LENGTH),
        name: obj.name
          ? String(obj.name).substring(0, MAX_NAME_LENGTH)
          : undefined,
        content_type: obj.content_type
          ? String(obj.content_type).substring(0, MAX_CONTENT_TYPE_LENGTH)
          : undefined,
        size_bytes: obj.size_bytes,
        state: obj.state
          ? String(obj.state).substring(0, MAX_STATE_LENGTH)
          : undefined,
        is_public: obj.is_public,
        create_time_ms: obj.create_time_ms,
      });
    });
  }

  // Access pagination properties from the result
  const pageResult = result as unknown as {
    objects: unknown[];
    total_count?: number;
    has_more?: boolean;
  };

  return {
    objects,
    totalCount: pageResult.total_count || objects.length,
    hasMore: pageResult.has_more || false,
  };
}

/**
 * Get full object details by ID
 */
export async function getObject(id: string): Promise<StorageObject> {
  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = await client.objects.retrieve(id);

  return {
    id: obj.id,
    name: obj.name || undefined,
    content_type: obj.content_type || undefined,
    size_bytes: obj.size_bytes,
    state: obj.state || undefined,
    is_public: obj.is_public,
    create_time_ms: obj.create_time_ms,
    download_url: obj.download_url || undefined,
    metadata: obj.metadata as Record<string, string> | undefined,
  };
}

/**
 * Delete an object
 */
export async function deleteObject(id: string): Promise<void> {
  const client = getClient();
  await client.objects.delete(id);
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null) return "Unknown";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex > 0 ? 2 : 0)} ${units[unitIndex]}`;
}

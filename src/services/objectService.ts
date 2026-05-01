/**
 * Object Service - Handles all storage object API calls
 */
import { getClient } from "../utils/client.js";
import { formatTimestamp } from "../utils/time.js";
import type { StorageObjectView } from "../store/objectStore.js";

export interface ListObjectsOptions {
  limit: number;
  startingAfter?: string;
  name?: string;
  contentType?: string;
  state?: string;
  isPublic?: boolean;
}

export interface ListObjectsResult {
  objects: StorageObjectView[];
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

  const objects: StorageObjectView[] = [];

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
        name: String(obj.name || "").substring(0, MAX_NAME_LENGTH),
        content_type: obj.content_type || "unspecified",
        create_time_ms: obj.create_time_ms || 0,
        state: obj.state || "UPLOADING",
        size_bytes: obj.size_bytes,
        delete_after_time_ms: obj.delete_after_time_ms,
        // UI-specific extended fields
        is_public: obj.is_public,
      });
    });
  }

  // Access pagination properties from the result
  const pageResult = result as unknown as {
    objects: unknown[];
    has_more?: boolean;
  };

  return {
    objects,
    totalCount: objects.length,
    hasMore: pageResult.has_more || false,
  };
}

/**
 * Get full object details by ID
 */
export async function getObject(id: string): Promise<StorageObjectView> {
  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = await client.objects.retrieve(id);

  return {
    id: obj.id,
    name: obj.name || "",
    content_type: obj.content_type || "unspecified",
    create_time_ms: obj.create_time_ms || 0,
    state: obj.state || "UPLOADING",
    size_bytes: obj.size_bytes,
    delete_after_time_ms: obj.delete_after_time_ms,
    // UI-specific extended fields
    is_public: obj.is_public,
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

export interface CreateObjectOptions {
  name: string;
  content_type: "unspecified" | "text" | "binary" | "gzip" | "tar" | "tgz";
  metadata?: Record<string, string>;
  ttl_ms?: number;
}

export interface CreateObjectResult {
  id: string;
  name: string;
  upload_url: string;
}

export async function createObject(
  options: CreateObjectOptions,
): Promise<CreateObjectResult> {
  const client = getClient();
  const response = await client.objects.create({
    name: options.name,
    content_type: options.content_type,
    metadata: options.metadata ?? undefined,
    ttl_ms: options.ttl_ms ?? undefined,
  });
  if (!response.upload_url) {
    throw new Error("API did not return an upload URL");
  }
  return {
    id: response.id,
    name: response.name,
    upload_url: response.upload_url,
  };
}

export async function completeObject(id: string): Promise<void> {
  const client = getClient();
  await client.objects.complete(id);
}

export async function uploadToPresignedUrl(
  uploadUrl: string,
  buffer: Buffer,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: buffer,
    headers: { "Content-Length": buffer.length.toString() },
  });
  if (!response.ok) {
    throw new Error(`Upload failed: HTTP ${response.status}`);
  }
}

export interface ObjectDetailField {
  label: string;
  value: string;
  color?: string;
}

/**
 * Build standard detail fields for a storage object.
 * Shared between ObjectDetailScreen and AgentDetailScreen.
 */
export function buildObjectDetailFields(
  obj: StorageObjectView,
): ObjectDetailField[] {
  const fields: ObjectDetailField[] = [];

  if (obj.content_type) {
    fields.push({ label: "Content Type", value: obj.content_type });
  }
  if (obj.size_bytes !== undefined && obj.size_bytes !== null) {
    fields.push({ label: "Size", value: formatFileSize(obj.size_bytes) });
  }
  if (obj.state) {
    fields.push({ label: "State", value: obj.state });
  }
  if (obj.is_public !== undefined) {
    fields.push({ label: "Public", value: obj.is_public ? "Yes" : "No" });
  }
  if (obj.create_time_ms) {
    fields.push({
      label: "Created",
      value: formatTimestamp(obj.create_time_ms) ?? "",
    });
  }
  if (obj.delete_after_time_ms) {
    const remainingMs = obj.delete_after_time_ms - Date.now();
    if (remainingMs <= 0) {
      fields.push({ label: "Expires", value: "Expired", color: "error" });
    } else {
      const remainingMinutes = Math.floor(remainingMs / 60000);
      if (remainingMinutes < 60) {
        fields.push({
          label: "Expires",
          value: `${remainingMinutes}m remaining`,
          color: remainingMinutes < 10 ? "warning" : undefined,
        });
      } else {
        const hours = Math.floor(remainingMinutes / 60);
        const mins = remainingMinutes % 60;
        fields.push({
          label: "Expires",
          value: `${hours}h ${mins}m remaining`,
        });
      }
    }
  }

  return fields;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number | null | undefined): string {
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

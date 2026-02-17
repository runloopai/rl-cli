/**
 * Snapshot Service - Handles all snapshot API calls
 */
import { getClient } from "../utils/client.js";
import type { Snapshot } from "../store/snapshotStore.js";
import type {
  DevboxListDiskSnapshotsParams,
  DevboxSnapshotDiskParams,
  DevboxSnapshotView,
} from "@runloop/api-client/resources/devboxes/devboxes";

export interface ListSnapshotsOptions {
  limit: number;
  startingAfter?: string;
  devboxId?: string;
}

export interface ListSnapshotsResult {
  snapshots: Snapshot[];
  totalCount: number;
  hasMore: boolean;
}

/**
 * List snapshots with pagination
 */
export async function listSnapshots(
  options: ListSnapshotsOptions,
): Promise<ListSnapshotsResult> {
  const client = getClient();

  const queryParams: DevboxListDiskSnapshotsParams = {
    limit: options.limit,
  };

  if (options.startingAfter) {
    queryParams.starting_after = options.startingAfter;
  }
  if (options.devboxId) {
    queryParams.devbox_id = options.devboxId;
  }

  const pagePromise = client.devboxes.listDiskSnapshots(queryParams);
  const page = await pagePromise;

  const snapshots: Snapshot[] = [];

  if (page.snapshots && Array.isArray(page.snapshots)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.snapshots.forEach((s: any) => {
      // CRITICAL: Truncate all strings to prevent Yoga crashes
      const MAX_ID_LENGTH = 100;
      const MAX_NAME_LENGTH = 200;
      const MAX_STATUS_LENGTH = 50;
      const MAX_COMMIT_MSG_LENGTH = 1000;

      // Status is constructed/available in API response but not in type definition
      const snapshotView = s as DevboxSnapshotView & { status?: string };

      snapshots.push({
        id: String(snapshotView.id || "").substring(0, MAX_ID_LENGTH),
        name: snapshotView.name
          ? String(snapshotView.name).substring(0, MAX_NAME_LENGTH)
          : undefined,
        commit_message: snapshotView.commit_message
          ? String(snapshotView.commit_message).substring(
              0,
              MAX_COMMIT_MSG_LENGTH,
            )
          : undefined,
        create_time_ms: snapshotView.create_time_ms,
        metadata: snapshotView.metadata || {},
        source_devbox_id: String(snapshotView.source_devbox_id || "").substring(
          0,
          MAX_ID_LENGTH,
        ),
        // UI-specific extended fields
        devbox_id: String(snapshotView.source_devbox_id || "").substring(
          0,
          MAX_ID_LENGTH,
        ),
        status: snapshotView.status
          ? String(snapshotView.status).substring(0, MAX_STATUS_LENGTH)
          : "",
      });
    });
  }

  const result = {
    snapshots,
    totalCount: page.total_count || snapshots.length,
    hasMore: page.has_more || false,
  };

  return result;
}

/**
 * Get snapshot status by ID
 */
export async function getSnapshotStatus(id: string): Promise<unknown> {
  const client = getClient();
  const status = await client.devboxes.diskSnapshots.queryStatus(id);
  return status;
}

/**
 * Get full snapshot details by ID
 */
export async function getSnapshot(id: string): Promise<Snapshot> {
  const client = getClient();
  const statusResponse = await client.devboxes.diskSnapshots.queryStatus(id);

  // The queryStatus returns a status wrapper with snapshot data inside
  const snapshot = statusResponse.snapshot;
  const operationStatus = statusResponse.status; // 'in_progress', 'error', 'complete', 'deleted'

  if (!snapshot) {
    // If no snapshot data yet, return minimal info based on operation status
    return {
      id: id,
      create_time_ms: Date.now(),
      metadata: {},
      source_devbox_id: "",
      status: operationStatus === "in_progress" ? "pending" : operationStatus,
    };
  }

  return {
    id: snapshot.id,
    name: snapshot.name || undefined,
    commit_message: snapshot.commit_message || undefined,
    create_time_ms: snapshot.create_time_ms,
    metadata: snapshot.metadata || {},
    source_devbox_id: snapshot.source_devbox_id || "",
    // UI-specific extended fields
    devbox_id: snapshot.source_devbox_id || undefined,
    status: operationStatus === "complete" ? "ready" : operationStatus,
  };
}

/**
 * Create a snapshot
 */
export async function createSnapshot(
  devboxId: string,
  options?: DevboxSnapshotDiskParams,
): Promise<Snapshot> {
  const client = getClient();
  const params: DevboxSnapshotDiskParams = {};

  if (options?.name) {
    params.name = options.name;
  }
  if (options?.commit_message) {
    params.commit_message = options.commit_message;
  }
  if (options?.metadata && Object.keys(options.metadata).length > 0) {
    params.metadata = options.metadata;
  }

  const snapshot = await client.devboxes.snapshotDisk(devboxId, params);

  return {
    id: snapshot.id,
    name: snapshot.name || undefined,
    create_time_ms: snapshot.create_time_ms,
    metadata: snapshot.metadata || {},
    source_devbox_id: snapshot.source_devbox_id || devboxId,
    // UI-specific extended fields
    devbox_id: snapshot.source_devbox_id || devboxId,
    status: "pending",
  };
}

/**
 * Delete a snapshot
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const client = getClient();
  await client.devboxes.diskSnapshots.delete(id);
}

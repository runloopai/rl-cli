/**
 * Snapshot Service - Handles all snapshot API calls
 */
import { getClient } from "../utils/client.js";
import type { Snapshot } from "../store/snapshotStore.js";
import type {
  DevboxListDiskSnapshotsParams,
  DevboxSnapshotView,
} from "@runloop/api-client/resources/devboxes/devboxes";
import type { DiskSnapshotsCursorIDPage } from "@runloop/api-client/pagination";

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
  const page =
    (await pagePromise) as unknown as DiskSnapshotsCursorIDPage<DevboxSnapshotView>;

  const snapshots: Snapshot[] = [];

  if (page.snapshots && Array.isArray(page.snapshots)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    page.snapshots.forEach((s: any) => {
      // CRITICAL: Truncate all strings to prevent Yoga crashes
      const MAX_ID_LENGTH = 100;
      const MAX_NAME_LENGTH = 200;
      const MAX_STATUS_LENGTH = 50;

      // Status is constructed/available in API response but not in type definition
      const snapshotView = s as DevboxSnapshotView & { status?: string };

      snapshots.push({
        id: String(snapshotView.id || "").substring(0, MAX_ID_LENGTH),
        name: snapshotView.name
          ? String(snapshotView.name).substring(0, MAX_NAME_LENGTH)
          : undefined,
        devbox_id: String(snapshotView.source_devbox_id || "").substring(
          0,
          MAX_ID_LENGTH,
        ),
        status: snapshotView.status
          ? String(snapshotView.status).substring(0, MAX_STATUS_LENGTH)
          : "",
        create_time_ms: snapshotView.create_time_ms,
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
export async function getSnapshotStatus(id: string): Promise<any> {
  const client = getClient();
  const status = await client.devboxes.diskSnapshots.queryStatus(id);
  return status;
}

/**
 * Create a snapshot
 */
export async function createSnapshot(
  devboxId: string,
  name?: string,
): Promise<Snapshot> {
  const client = getClient();
  const snapshot = await client.devboxes.snapshotDisk(devboxId, {
    name,
  });

  return {
    id: snapshot.id,
    name: snapshot.name || undefined,
    devbox_id: (snapshot as any).devbox_id || devboxId,
    status: (snapshot as any).status || "pending",
    create_time_ms: (snapshot as any).create_time_ms,
  };
}

/**
 * Delete a snapshot
 */
export async function deleteSnapshot(id: string): Promise<void> {
  const client = getClient();
  await client.devboxes.diskSnapshots.delete(id);
}

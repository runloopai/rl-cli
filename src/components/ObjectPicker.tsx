/**
 * ObjectPicker - Reusable component for selecting storage objects
 * Wraps ResourcePicker with object-specific configuration
 */
import React from "react";
import {
  ResourcePicker,
  createTextColumn,
  type Column,
} from "./ResourcePicker.js";
import { formatTimeAgo } from "./ResourceListView.js";
import { getClient } from "../utils/client.js";
import { formatFileSize } from "../services/objectService.js";
import { colors } from "../utils/theme.js";
import type { BreadcrumbItem } from "./Breadcrumb.js";

export interface ObjectListItem {
  id: string;
  name?: string;
  content_type?: string;
  size_bytes?: number;
  state?: string;
  create_time_ms?: number;
}

export interface ObjectPickerProps {
  /** Called when object(s) are selected */
  onSelect: (objects: ObjectListItem[]) => void;
  /** Called when picker is cancelled */
  onCancel: () => void;
  /** Selection mode - single or multi */
  mode?: "single" | "multi";
  /** Title for the picker */
  title?: string;
  /** Breadcrumb items */
  breadcrumbItems?: BreadcrumbItem[];
  /** Initially selected object IDs */
  initialSelected?: string[];
  /** Additional lines of overhead from wrapper components (e.g., tab headers) */
  additionalOverhead?: number;
}

/**
 * Build columns for object picker table
 */
function buildObjectColumns(tw: number): Column<ObjectListItem>[] {
  const fixedWidth = 6;
  const idWidth = 25;
  const typeWidth = 12;
  const stateWidth = 10;
  const sizeWidth = 10;
  const baseWidth = fixedWidth + idWidth + typeWidth + stateWidth + sizeWidth;
  const nameWidth = Math.min(
    30,
    Math.max(12, Math.floor((tw - baseWidth) * 0.5)),
  );
  const timeWidth = Math.max(18, tw - baseWidth - nameWidth);

  return [
    createTextColumn<ObjectListItem>("id", "ID", (o) => o.id, {
      width: idWidth + 1,
      color: colors.idColor,
    }),
    createTextColumn<ObjectListItem>("name", "Name", (o) => o.name || "", {
      width: nameWidth,
    }),
    createTextColumn<ObjectListItem>(
      "type",
      "Type",
      (o) => o.content_type || "",
      { width: typeWidth, color: colors.textDim },
    ),
    createTextColumn<ObjectListItem>("state", "State", (o) => o.state || "", {
      width: stateWidth,
      color: colors.textDim,
    }),
    createTextColumn<ObjectListItem>(
      "size",
      "Size",
      (o) => formatFileSize(o.size_bytes),
      { width: sizeWidth, color: colors.textDim },
    ),
    createTextColumn<ObjectListItem>(
      "created",
      "Created",
      (o) => (o.create_time_ms ? formatTimeAgo(o.create_time_ms) : ""),
      { width: timeWidth, color: colors.textDim },
    ),
  ];
}

/**
 * Fetch a page of objects from the API
 */
async function fetchObjectsPage(params: {
  limit: number;
  startingAt?: string;
  search?: string;
}): Promise<{
  items: ObjectListItem[];
  hasMore: boolean;
  totalCount?: number;
}> {
  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queryParams: Record<string, any> = {
    limit: params.limit,
  };
  if (params.startingAt) {
    queryParams.starting_after = params.startingAt;
  }
  if (params.search) {
    queryParams.search = params.search;
  }
  const result = await client.objects.list(queryParams);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageResult = result as any;
  const objects = (pageResult.objects || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (o: any) => ({
      id: o.id,
      name: o.name,
      content_type: o.content_type,
      size_bytes: o.size_bytes,
      state: o.state,
      create_time_ms: o.create_time_ms,
    }),
  );
  return {
    items: objects,
    hasMore: pageResult.has_more || false,
    totalCount: pageResult.total_count,
  };
}

/**
 * ObjectPicker component for selecting storage objects
 */
export function ObjectPicker({
  onSelect,
  onCancel,
  mode = "single",
  title = "Select Object",
  breadcrumbItems,
  initialSelected = [],
  additionalOverhead,
}: ObjectPickerProps) {
  return (
    <ResourcePicker<ObjectListItem>
      key="object-picker"
      config={{
        title,
        fetchPage: fetchObjectsPage,
        getItemId: (o) => o.id,
        getItemLabel: (o) => o.name || o.id,
        columns: buildObjectColumns,
        mode,
        emptyMessage: "No objects found",
        searchPlaceholder: "Search objects...",
        breadcrumbItems,
        additionalOverhead,
      }}
      onSelect={onSelect}
      onCancel={onCancel}
      initialSelected={initialSelected}
    />
  );
}

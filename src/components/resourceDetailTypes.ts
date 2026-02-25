/**
 * Shared types for the ResourceDetailPage component and its consumers.
 */
import React from "react";
import type { ScreenName, RouteParams } from "../store/navigationStore.js";

// ---------------------------------------------------------------------------
// Detail field types
// ---------------------------------------------------------------------------

/** Action that can be triggered from an actionable detail field. */
export interface DetailFieldAction {
  /** Type of action */
  type: "navigate" | "callback";
  /** For navigate: screen name to navigate to */
  screen?: ScreenName;
  /** For navigate: params to pass */
  params?: RouteParams;
  /** For callback: custom function to execute */
  handler?: () => void;
  /** Hint text shown next to field, e.g. "View Blueprint" */
  hint?: string;
}

/** A single field within a detail section. */
export interface DetailField {
  label: string;
  value: string | React.ReactNode | undefined | null;
  color?: string;
  /** Optional action to trigger when this field is selected and Enter is pressed */
  action?: DetailFieldAction;
}

/** A group of related fields displayed under a section heading. */
export interface DetailSection {
  title: string;
  icon?: string;
  color?: string;
  fields: DetailField[];
}

/** An operation/action available for the resource (shown in the Actions menu). */
export interface ResourceOperation {
  key: string;
  label: string;
  color: string;
  icon: string;
  shortcut: string;
}

// ---------------------------------------------------------------------------
// Actionable field helpers
// ---------------------------------------------------------------------------

/** Reference to an actionable field by section/field index plus its action. */
export interface ActionableFieldRef {
  sectionIndex: number;
  fieldIndex: number;
  action: DetailFieldAction;
}

/** Reference to a section that can be opened in the section detail view (truncated or hidden). */
export interface SectionViewRef {
  sectionIndex: number;
  section: DetailSection;
  /** True if at least some fields are visible in the main view (partial truncation). */
  partiallyVisible: boolean;
}

/**
 * Walk all sections and collect fields that have an action defined.
 * Returns a flat list of references preserving section/field indices
 * so the component can map selections back to the right field.
 */
export function collectActionableFields(
  sections: DetailSection[],
): ActionableFieldRef[] {
  const refs: ActionableFieldRef[] = [];
  sections.forEach((section, sectionIndex) => {
    section.fields
      .filter((field) => field.value !== undefined && field.value !== null)
      .forEach((field, fieldIndex) => {
        if (field.action) {
          refs.push({ sectionIndex, fieldIndex, action: field.action });
        }
      });
  });
  return refs;
}

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

export interface ResourceDetailPageProps<T> {
  /** The resource being displayed */
  resource: T;
  /** Resource type name for breadcrumbs (e.g., "Blueprints", "Snapshots") */
  resourceType: string;
  /** Get display name for the resource */
  getDisplayName: (resource: T) => string;
  /** Get resource ID */
  getId: (resource: T) => string;
  /** Get resource status */
  getStatus: (resource: T) => string;
  /** Optional: Get URL to open in browser */
  getUrl?: (resource: T) => string;
  /** Breadcrumb items before the resource name */
  breadcrumbPrefix?: Array<{ label: string; active?: boolean }>;
  /** Detail sections to display in main view */
  detailSections: DetailSection[];
  /** Available operations/actions */
  operations: ResourceOperation[];
  /** Callback when operation is selected */
  onOperation: (operation: string, resource: T) => void;
  /** Callback to go back */
  onBack: () => void;
  /** Optional: Build detailed info lines for full details view */
  buildDetailLines?: (resource: T) => React.ReactElement[];
  /** Optional: Additional content to render after details section */
  additionalContent?: React.ReactNode;
}

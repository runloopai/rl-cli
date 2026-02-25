/**
 * SectionDetailView - Scrollable full view for a single detail section.
 * Used when the user selects "View [Section name]" on a truncated/hidden section.
 */
import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { Breadcrumb } from "./Breadcrumb.js";
import { colors } from "../utils/theme.js";
import type { DetailSection } from "./resourceDetailTypes.js";

export interface SectionDetailViewProps {
  /** The section to display */
  section: DetailSection;
  /** Title for breadcrumb (e.g. section name) */
  sectionTitle: string;
  /** Current scroll offset */
  scrollOffset: number;
  /** Maximum visible lines */
  viewportHeight: number;
  /** Callback when user exits (q/esc) */
  onBack: () => void;
  /** Resource type for breadcrumbs (e.g. "Benchmark Runs") */
  resourceType: string;
  /** Resource display name for breadcrumbs */
  displayName: string;
  /** Optional breadcrumb prefix items */
  breadcrumbPrefix?: Array<{ label: string; active?: boolean }>;
}

/**
 * Build scrollable lines from a section: one line for title, one per field.
 */
function sectionToLines(section: DetailSection): React.ReactElement[] {
  const lines: React.ReactElement[] = [];
  const filteredFields = section.fields.filter(
    (f) => f.value !== undefined && f.value !== null,
  );

  lines.push(
    <Text key="title" color={section.color || colors.warning} bold>
      {section.icon || figures.squareSmallFilled} {section.title}
    </Text>,
  );
  filteredFields.forEach((field, idx) => {
    lines.push(
      <Box key={idx}>
        <Text color={colors.textDim} bold>
          {field.label}
          {field.label ? " " : ""}
        </Text>
        {typeof field.value === "string" ? (
          <Text color={field.color} dimColor={!field.color}>
            {field.value}
          </Text>
        ) : (
          field.value
        )}
      </Box>,
    );
  });
  return lines;
}

export function SectionDetailView({
  section,
  sectionTitle,
  scrollOffset,
  viewportHeight,
  onBack,
  resourceType,
  displayName,
  breadcrumbPrefix = [],
}: SectionDetailViewProps) {
  const detailLines = React.useMemo(
    () => sectionToLines(section),
    [section],
  );
  const maxScroll = Math.max(0, detailLines.length - viewportHeight);
  const actualScroll = Math.min(scrollOffset, maxScroll);
  const visibleLines = detailLines.slice(
    actualScroll,
    actualScroll + viewportHeight,
  );
  const hasMore = actualScroll + viewportHeight < detailLines.length;
  const hasLess = actualScroll > 0;

  return (
    <>
      <Breadcrumb
        items={[
          ...breadcrumbPrefix,
          { label: resourceType },
          { label: displayName },
          { label: sectionTitle, active: true },
        ]}
      />
      <Box
        flexDirection="column"
        marginTop={1}
        marginBottom={1}
        borderStyle="round"
        borderColor={colors.border}
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="column">{visibleLines}</Box>
      </Box>
      <Box marginTop={1}>
        <Text color={colors.textDim} dimColor>
          {figures.arrowUp}
          {figures.arrowDown} Scroll • Line {actualScroll + 1}-
          {Math.min(actualScroll + viewportHeight, detailLines.length)} of{" "}
          {detailLines.length}
        </Text>
        {hasLess && <Text color={colors.primary}> {figures.arrowUp}</Text>}
        {hasMore && <Text color={colors.primary}> {figures.arrowDown}</Text>}
        <Text color={colors.textDim} dimColor>
          {" "}
          • [q or esc] Back to Details
        </Text>
      </Box>
    </>
  );
}

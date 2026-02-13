/**
 * DetailedInfoView - Full-screen scrollable detail view for resources.
 *
 * Extracted from ResourceDetailPage to reduce component size.
 * Displays all resource information in a scrollable, bordered container.
 */
import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { Header } from "./Header.js";
import { StatusBadge } from "./StatusBadge.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { colors } from "../utils/theme.js";

interface DetailedInfoViewProps {
  /** Lines of React elements to display */
  detailLines: React.ReactElement[];
  /** Current scroll offset */
  scrollOffset: number;
  /** Maximum visible lines */
  viewportHeight: number;
  /** Display name of the resource */
  displayName: string;
  /** Resource ID */
  resourceId: string;
  /** Resource status string */
  status: string;
  /** Resource type for breadcrumbs (e.g. "Devboxes") */
  resourceType: string;
  /** Optional breadcrumb prefix items */
  breadcrumbPrefix?: Array<{ label: string; active?: boolean }>;
}

export function DetailedInfoView({
  detailLines,
  scrollOffset,
  viewportHeight,
  displayName,
  resourceId,
  status,
  resourceType,
  breadcrumbPrefix = [],
}: DetailedInfoViewProps) {
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
          { label: "Full Details", active: true },
        ]}
      />
      <Header title={`${displayName} - Complete Information`} />
      <Box flexDirection="column" marginBottom={1}>
        <Box marginBottom={1}>
          <StatusBadge status={status} />
          <Text> </Text>
          <Text color={colors.idColor}>{resourceId}</Text>
        </Box>
      </Box>

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

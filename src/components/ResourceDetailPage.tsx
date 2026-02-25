/**
 * ResourceDetailPage - Generic detail page component for resources
 * Can be used for devboxes, blueprints, snapshots, etc.
 */
import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { StatusBadge } from "./StatusBadge.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { DetailedInfoView } from "./DetailedInfoView.js";
import { NavigationTips } from "./NavigationTips.js";
import { colors } from "../utils/theme.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { useVerticalLayout } from "../hooks/useVerticalLayout.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import {
  useInputHandler,
  scrollBindings,
  type InputMode,
} from "../hooks/useInputHandler.js";
import { useNavigation } from "../store/navigationStore.js";
import { openInBrowser as openUrlInBrowser } from "../utils/browser.js";
import { copyToClipboard } from "../utils/clipboard.js";
import {
  collectActionableFields,
  type DetailFieldAction,
  type DetailSection,
  type ResourceDetailPageProps,
  type SectionViewRef,
} from "./resourceDetailTypes.js";
import { SectionDetailView } from "./SectionDetailView.js";

// Re-export all types so existing consumers don't need to change their imports
export type {
  DetailFieldAction,
  DetailField,
  DetailSection,
  ResourceOperation,
  ResourceDetailPageProps,
  SectionViewRef,
} from "./resourceDetailTypes.js";
export { collectActionableFields } from "./resourceDetailTypes.js";

// Truncate long strings to prevent layout issues
const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
};

export interface SectionAllocation {
  /** Per-section: how many fields to show in main view (0 = header only or not shown) */
  visibleFieldCount: number[];
  /** Sections that have hidden content and get a "View section" selectable entry */
  sectionViewRefs: SectionViewRef[];
}

/**
 * Allocate available lines to sections. Section order = priority (first sections get space first).
 */
function allocateSectionLines(
  detailSections: DetailSection[],
  linesAvailable: number,
): SectionAllocation {
  const visibleFieldCount: number[] = [];
  const sectionViewRefs: SectionViewRef[] = [];

  const fieldCounts = detailSections.map((s) =>
    s.fields.filter(
      (f) => f.value !== undefined && f.value !== null,
    ).length,
  );

  if (linesAvailable <= 0) {
    detailSections.forEach((section, i) => {
      visibleFieldCount.push(0);
      if (fieldCounts[i] > 0) {
        sectionViewRefs.push({
          sectionIndex: i,
          section,
          partiallyVisible: false,
        });
      }
    });
    return { visibleFieldCount, sectionViewRefs };
  }

  // Reserve 1 line per section header + 1 per section for potential "View section" row
  const headerAndViewRowLines = detailSections.length * 2;
  if (linesAvailable < detailSections.length) {
    // Only enough for some section headers; no field lines
    let used = 0;
    detailSections.forEach((section, i) => {
      visibleFieldCount.push(0);
      if (fieldCounts[i] > 0) {
        sectionViewRefs.push({
          sectionIndex: i,
          section,
          partiallyVisible: used < linesAvailable,
        });
      }
      used += 1;
    });
    return { visibleFieldCount, sectionViewRefs };
  }

  let fieldLinesAvailable = Math.max(0, linesAvailable - headerAndViewRowLines);
  // First pass: give single-field sections (e.g. Error one-liner) at least 1 line so they're visible
  const singleFieldSections = detailSections
    .map((_, i) => (fieldCounts[i] === 1 ? i : -1))
    .filter((i) => i >= 0);
  const reserveForSingles = Math.min(
    singleFieldSections.length,
    fieldLinesAvailable,
  );
  const perSectionTake = new Map<number, number>();
  for (let s = 0; s < reserveForSingles; s++) {
    perSectionTake.set(singleFieldSections[s], 1);
  }
  fieldLinesAvailable -= reserveForSingles;

  detailSections.forEach((section, i) => {
    const want = fieldCounts[i];
    const guaranteed = perSectionTake.get(i) ?? 0;
    const take = Math.min(
      want,
      guaranteed + Math.min(Math.max(0, want - guaranteed), fieldLinesAvailable),
    );
    visibleFieldCount.push(take);
    fieldLinesAvailable -= Math.max(0, take - guaranteed);
    if (take < want && want > 0) {
      sectionViewRefs.push({
        sectionIndex: i,
        section,
        partiallyVisible: take > 0,
      });
    }
  });
  return { visibleFieldCount, sectionViewRefs };
}

export function ResourceDetailPage<T>({
  resource,
  resourceType,
  getDisplayName,
  getId,
  getStatus,
  getUrl,
  breadcrumbPrefix = [],
  detailSections,
  operations,
  onOperation,
  onBack,
  buildDetailLines,
  additionalContent,
}: ResourceDetailPageProps<T>) {
  const isMounted = React.useRef(true);
  const { navigate } = useNavigation();

  // Track mounted state
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);

  // Copy to clipboard with status feedback
  const handleCopy = React.useCallback(async (text: string) => {
    const status = await copyToClipboard(text);
    setCopyStatus(status);
    setTimeout(() => setCopyStatus(null), 2000);
  }, []);

  const [showDetailedInfo, setShowDetailedInfo] = React.useState(false);
  const [detailScroll, setDetailScroll] = React.useState(0);
  const [showSectionDetail, setShowSectionDetail] = React.useState<
    number | null
  >(null);
  const [sectionScroll, setSectionScroll] = React.useState(0);
  const [showActionsList, setShowActionsList] = React.useState(false);
  const [actionsListSelectedIndex, setActionsListSelectedIndex] = React.useState(0);

  // Vertical layout first so we have maxVisibleActions (responsive to terminal height)
  const layout = useVerticalLayout({
    screenType: "detail",
    operationCount: operations.length,
  });
  const linesAvailableForSections = layout.contentLines;
  const maxVisibleOperations = layout.maxVisibleActions;
  const minimalChromeLayout = layout.minimalChrome ?? false;

  // When minimal chrome (very small height), show only one "Actions…" row that opens the list
  const displayedOperationCount =
    minimalChromeLayout && operations.length > 0
      ? 1
      : operations.length > maxVisibleOperations
        ? maxVisibleOperations + 1
        : operations.length;
  const visibleOperations =
    minimalChromeLayout && operations.length > 0
      ? []
      : operations.length > maxVisibleOperations
        ? operations.slice(0, maxVisibleOperations)
        : operations;
  const hasViewRestOfActions =
    minimalChromeLayout && operations.length > 0
      ? true
      : operations.length > maxVisibleOperations;
  const actionsOpenListIndex = minimalChromeLayout ? 0 : maxVisibleOperations;

  // Viewport for full-detail and section-detail overlay views (scroll height)
  const detailViewport = useViewportHeight({ overhead: 18, minHeight: 10 });

  // Section allocation: how many fields to show per section, and which sections get "View section" refs
  const allocation = React.useMemo(
    () => allocateSectionLines(detailSections, linesAvailableForSections),
    [detailSections, linesAvailableForSections],
  );
  const { visibleFieldCount, sectionViewRefs } = allocation;

  // Unified selectable items: actionable fields, then section-view refs, then operations (capped when many).
  const actionableFields = React.useMemo(
    () => collectActionableFields(detailSections),
    [detailSections],
  );
  const totalSelectableItems =
    actionableFields.length + sectionViewRefs.length + displayedOperationCount;
  const operationsStartIndex =
    actionableFields.length + sectionViewRefs.length;
  // Default selection: first operation (skip links and section refs)
  const [selectedIndex, setSelectedIndex] = React.useState(
    totalSelectableItems > 0
      ? Math.min(operationsStartIndex, totalSelectableItems - 1)
      : 0,
  );

  // Clamp selectedIndex when the number of selectable items shrinks
  React.useEffect(() => {
    if (totalSelectableItems > 0 && selectedIndex >= totalSelectableItems) {
      setSelectedIndex(totalSelectableItems - 1);
    }
  }, [totalSelectableItems, selectedIndex]);

  // If we're in section detail but that section no longer exists, return to main view
  React.useEffect(() => {
    if (
      showSectionDetail !== null &&
      !detailSections[showSectionDetail]
    ) {
      setShowSectionDetail(null);
      setSectionScroll(0);
    }
  }, [showSectionDetail, detailSections]);

  // Section detail viewport height (same as detailed info)
  const sectionDetailViewport = useViewportHeight({ overhead: 18, minHeight: 10 });

  const displayName = getDisplayName(resource);
  const resourceId = getId(resource);
  const status = getStatus(resource);

  // Execute a field action
  const executeFieldAction = React.useCallback(
    (action: DetailFieldAction) => {
      if (action.type === "navigate" && action.screen) {
        navigate(action.screen, action.params || {});
      } else if (action.type === "callback" && action.handler) {
        action.handler();
      }
    },
    [navigate],
  );

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Helpers: selection is on a link, a section-view ref, or an operation?
  const isOnLink = selectedIndex < actionableFields.length;
  const isOnSectionRef =
    selectedIndex >= actionableFields.length &&
    selectedIndex < operationsStartIndex;
  const sectionRefIndex = isOnSectionRef
    ? selectedIndex - actionableFields.length
    : -1;
  const operationIndex = selectedIndex - operationsStartIndex;

  const handleOpenInBrowser = React.useCallback(() => {
    if (!getUrl) return;
    openUrlInBrowser(getUrl(resource));
  }, [getUrl, resource]);

  const exitDetailedInfo = React.useCallback(() => {
    setShowDetailedInfo(false);
    setDetailScroll(0);
  }, []);

  const exitSectionDetail = React.useCallback(() => {
    setShowSectionDetail(null);
    setSectionScroll(0);
  }, []);

  const handleEnter = React.useCallback(() => {
    if (isOnLink) {
      const ref = actionableFields[selectedIndex];
      if (ref) {
        executeFieldAction(ref.action);
      }
    } else if (isOnSectionRef && sectionRefIndex >= 0 && sectionViewRefs[sectionRefIndex]) {
      setShowSectionDetail(sectionViewRefs[sectionRefIndex].sectionIndex);
      setSectionScroll(0);
    } else if (hasViewRestOfActions && operationIndex === actionsOpenListIndex) {
      setShowActionsList(true);
      setActionsListSelectedIndex(0);
    } else {
      const op = operations[operationIndex];
      if (op) {
        onOperation(op.key, resource);
      }
    }
  }, [
    isOnLink,
    isOnSectionRef,
    sectionRefIndex,
    sectionViewRefs,
    hasViewRestOfActions,
    actionsOpenListIndex,
    operationIndex,
    operations,
    resource,
    executeFieldAction,
    onOperation,
  ]);

  const exitActionsList = React.useCallback(() => {
    setShowActionsList(false);
  }, []);

  const inputModes: InputMode[] = React.useMemo(
    () => [
      {
        name: "actionsList",
        active: () => showActionsList,
        bindings: {
          up: () => {
            if (actionsListSelectedIndex > 0)
              setActionsListSelectedIndex(actionsListSelectedIndex - 1);
          },
          down: () => {
            if (actionsListSelectedIndex < operations.length - 1)
              setActionsListSelectedIndex(actionsListSelectedIndex + 1);
          },
          enter: () => {
            const op = operations[actionsListSelectedIndex];
            if (op) {
              onOperation(op.key, resource);
              setShowActionsList(false);
            }
          },
          q: exitActionsList,
          escape: exitActionsList,
        },
      },
      {
        name: "sectionDetail",
        active: () => showSectionDetail !== null,
        bindings: {
          ...scrollBindings(() => sectionScroll, setSectionScroll),
          q: exitSectionDetail,
          escape: exitSectionDetail,
        },
      },
      {
        name: "detailedInfo",
        active: () => showDetailedInfo,
        bindings: {
          ...scrollBindings(() => detailScroll, setDetailScroll),
          q: exitDetailedInfo,
          escape: exitDetailedInfo,
        },
      },
      {
        name: "mainView",
        active: () => true,
        bindings: {
          q: onBack,
          escape: onBack,
          c: () => handleCopy(getId(resource)),
          ...(buildDetailLines
            ? {
                i: () => {
                  setShowDetailedInfo(true);
                  setDetailScroll(0);
                },
              }
            : {}),
          up: () => {
            if (selectedIndex > 0) setSelectedIndex(selectedIndex - 1);
          },
          down: () => {
            if (selectedIndex < totalSelectableItems - 1)
              setSelectedIndex(selectedIndex + 1);
          },
          enter: handleEnter,
          ...(getUrl ? { o: handleOpenInBrowser } : {}),
        },
        onUnmatched: (input) => {
          // Operation shortcuts work from anywhere (all ops, including those in "View rest")
          const matchedOpIndex = operations.findIndex(
            (op) => op.shortcut === input,
          );
          if (matchedOpIndex !== -1) {
            const slot =
              operations.length > maxVisibleOperations
                ? Math.min(matchedOpIndex, maxVisibleOperations)
                : matchedOpIndex;
            setSelectedIndex(operationsStartIndex + slot);
            onOperation(operations[matchedOpIndex].key, resource);
          }
        },
      },
    ],
    [
      showActionsList,
      actionsListSelectedIndex,
      operations,
      onOperation,
      resource,
      exitActionsList,
      showSectionDetail,
      sectionScroll,
      exitSectionDetail,
      showDetailedInfo,
      detailScroll,
      exitDetailedInfo,
      onBack,
      buildDetailLines,
      selectedIndex,
      totalSelectableItems,
      handleEnter,
      getUrl,
      handleOpenInBrowser,
      operations,
      operationsStartIndex,
      onOperation,
      getId,
    ],
  );

  useInputHandler(inputModes, { isActive: isMounted.current });

  // Detailed info mode - full screen
  if (showDetailedInfo && buildDetailLines) {
    return (
      <DetailedInfoView
        detailLines={buildDetailLines(resource)}
        scrollOffset={detailScroll}
        viewportHeight={detailViewport.viewportHeight}
        displayName={displayName}
        resourceId={resourceId}
        status={status}
        resourceType={resourceType}
        breadcrumbPrefix={breadcrumbPrefix}
      />
    );
  }

  // Section detail mode - single section full view
  if (showSectionDetail !== null) {
    const section = detailSections[showSectionDetail];
    if (section) {
      return (
        <SectionDetailView
          section={section}
          sectionTitle={section.title}
          scrollOffset={sectionScroll}
          viewportHeight={sectionDetailViewport.viewportHeight}
          onBack={exitSectionDetail}
          resourceType={resourceType}
          displayName={displayName}
          breadcrumbPrefix={breadcrumbPrefix}
        />
      );
    }
  }

  // Actions list overlay (when "View rest of Actions" is opened)
  if (showActionsList) {
    return (
      <>
        <Breadcrumb
          items={[
            ...breadcrumbPrefix,
            { label: resourceType },
            { label: displayName ?? resourceId },
            { label: "Actions" },
          ]}
          compactMode={layout.breadcrumbMode}
        />
        <Box flexDirection="column" paddingX={1}>
          <Text color={colors.primary} bold>
            Select an action
          </Text>
          <Box flexDirection="column" paddingLeft={2} marginTop={1}>
            {operations.map((op, index) => {
              const isSelected = index === actionsListSelectedIndex;
              return (
                <Box key={op.key}>
                  <Text color={isSelected ? colors.primary : colors.textDim}>
                    {isSelected ? figures.pointer : " "}{" "}
                  </Text>
                  <Text
                    color={isSelected ? op.color : colors.textDim}
                    bold={isSelected}
                  >
                    {op.icon} {op.label}
                  </Text>
                  <Text color={colors.textDim} dimColor>
                    {" "}
                    [{op.shortcut}]
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>
        <NavigationTips
          showArrows
          displayMode={layout.navTipsMode}
          tips={[
            { key: "Enter", label: "Run action" },
            { key: "q/Esc", label: "Back" },
          ]}
        />
      </>
    );
  }

  const minimalChrome = minimalChromeLayout;

  // Main detail view
  return (
    <>
      <Breadcrumb
        items={[
          ...breadcrumbPrefix,
          { label: resourceType },
          { label: displayName, active: true },
        ]}
        compactMode={layout.breadcrumbMode}
      />

      {/* Main info: one line when minimal chrome so top is never cut off */}
      {minimalChrome ? (
        <Box flexDirection="row" paddingX={1}>
          <Text color={colors.primary} bold>
            {truncateString(displayName, Math.max(12, layout.terminalWidth - 20))}
          </Text>
          <Text color={colors.textDim}> • </Text>
          <StatusBadge status={status} fullText />
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1} marginBottom={1} paddingX={1}>
          <Box flexDirection="row">
            <Text color={colors.primary} bold>
              {truncateString(
                displayName,
                Math.max(20, layout.terminalWidth - 35),
              )}
            </Text>
            {displayName !== resourceId && (
              <Text color={colors.idColor}> • {resourceId}</Text>
            )}
          </Box>
          <Box>
            <StatusBadge status={status} fullText />
          </Box>
        </Box>
      )}

      {/* Detail sections (viewport-aware: only visible fields + "View section" rows) */}
      {detailSections.map((section, sectionIndex) => {
        const visibleCount = visibleFieldCount[sectionIndex] ?? 0;
        const filteredFields = section.fields.filter(
          (f) => f.value !== undefined && f.value !== null,
        );
        const hasSectionViewRef = sectionViewRefs.some(
          (r) => r.sectionIndex === sectionIndex,
        );
        const sectionRefIdx = hasSectionViewRef
          ? sectionViewRefs.findIndex((r) => r.sectionIndex === sectionIndex)
          : -1;
        const viewSectionSelectIndex =
          sectionRefIdx >= 0
            ? actionableFields.length + sectionRefIdx
            : -1;
        const isViewSectionSelected =
          viewSectionSelectIndex >= 0 &&
          selectedIndex === viewSectionSelectIndex;
        const viewSectionLabel =
          visibleCount > 0
            ? `View rest of ${section.title}`
            : `View ${section.title}`;

        return (
          <Box
            key={sectionIndex}
            flexDirection="column"
            marginBottom={minimalChrome ? 0 : 1}
          >
            {/* Section header always shown so the section looks like a section */}
            <Text color={section.color || colors.warning} bold>
              {section.icon || figures.squareSmallFilled} {section.title}
            </Text>
            <Box flexDirection="column" paddingLeft={2}>
              {filteredFields
                .slice(0, visibleCount)
                .map((field, fieldIndex) => {
                  const isActionable = !!field.action;
                  const actionableIdx = isActionable
                    ? actionableFields.findIndex(
                        (r) =>
                          r.sectionIndex === sectionIndex &&
                          r.fieldIndex === fieldIndex,
                      )
                    : -1;
                  const isFieldSelected =
                    isActionable && actionableIdx === selectedIndex;

                  return (
                    <Box key={fieldIndex}>
                      {isActionable ? (
                        <Text
                          color={
                            isFieldSelected
                              ? colors.primary
                              : colors.textDim
                          }
                        >
                          {isFieldSelected ? figures.pointer : " "}{" "}
                        </Text>
                      ) : null}
                      <Text
                        color={
                          isFieldSelected ? colors.primary : colors.textDim
                        }
                        bold={isFieldSelected}
                      >
                        {field.label}
                        {field.label ? " " : ""}
                      </Text>
                      {typeof field.value === "string" ? (
                        <Text
                          color={
                            isFieldSelected
                              ? colors.primary
                              : field.color || undefined
                          }
                          dimColor={!isFieldSelected && !field.color}
                          bold={isFieldSelected}
                        >
                          {field.value}
                        </Text>
                      ) : (
                        field.value
                      )}
                      {isFieldSelected && field.action?.hint && (
                        <Text color={colors.textDim} dimColor>
                          {" "}
                          [Enter: {field.action.hint}]
                        </Text>
                      )}
                    </Box>
                  );
                })}
              {/* Selectable "View section" row when section has hidden content */}
              {hasSectionViewRef && (
                <Box>
                  <Text
                    color={
                      isViewSectionSelected ? colors.primary : colors.textDim
                    }
                  >
                    {isViewSectionSelected ? figures.pointer : " "}{" "}
                  </Text>
                  <Text
                    color={
                      isViewSectionSelected ? colors.primary : colors.textDim
                    }
                    bold={isViewSectionSelected}
                    dimColor={!isViewSectionSelected}
                  >
                    {viewSectionLabel}
                  </Text>
                  <Text color={colors.textDim} dimColor>
                    {" "}
                    [Enter: View section]
                  </Text>
                </Box>
              )}
            </Box>
          </Box>
        );
      })}

      {/* Additional content (e.g., StateHistory for devboxes) */}
      {additionalContent}

      {/* Actions section: minimal chrome = one line; otherwise capped list + "View rest" */}
      {operations.length > 0 && (
        <Box flexDirection="column" marginTop={minimalChrome ? 0 : 1}>
          {minimalChrome ? (
            <Box paddingLeft={2}>
              <Text
                color={
                  selectedIndex === operationsStartIndex
                    ? colors.primary
                    : colors.textDim
                }
                bold={selectedIndex === operationsStartIndex}
              >
                {selectedIndex === operationsStartIndex
                  ? figures.pointer
                  : " "}{" "}
                Actions… [Enter: open list]
              </Text>
            </Box>
          ) : (
            <>
              <Text color={colors.primary} bold>
                {figures.play} Actions
              </Text>
              <Box flexDirection="column" paddingLeft={2}>
                {visibleOperations.map((op, index) => {
                  const isSelected =
                    index + operationsStartIndex === selectedIndex;
                  return (
                    <Box key={op.key}>
                      <Text color={isSelected ? colors.primary : colors.textDim}>
                        {isSelected ? figures.pointer : " "}{" "}
                      </Text>
                      <Text
                        color={isSelected ? op.color : colors.textDim}
                        bold={isSelected}
                      >
                        {op.icon} {op.label}
                      </Text>
                      <Text color={colors.textDim} dimColor>
                        {" "}
                        [{op.shortcut}]
                      </Text>
                    </Box>
                  );
                })}
                {hasViewRestOfActions && (
                  <Box>
                    <Text
                      color={
                        operationsStartIndex + actionsOpenListIndex === selectedIndex
                          ? colors.primary
                          : colors.textDim
                      }
                      bold={
                        operationsStartIndex + actionsOpenListIndex === selectedIndex
                      }
                    >
                      {operationsStartIndex + actionsOpenListIndex === selectedIndex
                        ? figures.pointer
                        : " "}{" "}
                      View rest of Actions
                    </Text>
                  </Box>
                )}
              </Box>
            </>
          )}
        </Box>
      )}

      {copyStatus && (
        <Box marginTop={1} paddingX={1}>
          <Text color={colors.success} bold>
            {copyStatus}
          </Text>
        </Box>
      )}

      <NavigationTips
        showArrows
        displayMode={layout.navTipsMode}
        tips={[
          {
            key: "Enter",
            label: isOnLink
              ? "Open Link"
              : isOnSectionRef
                ? "View section"
                : "Execute",
          },
          { key: "c", label: "Copy ID" },
          { key: "i", label: "Full Details", condition: !!buildDetailLines },
          { key: "o", label: "Browser", condition: !!getUrl },
          { key: "q/Ctrl+C", label: "Back/Quit" },
        ]}
      />
    </>
  );
}

// Re-export format helpers from utils/time for backward compatibility
export { formatTimestamp, formatTimeRange } from "../utils/time.js";

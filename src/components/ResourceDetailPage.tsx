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
  type ResourceDetailPageProps,
} from "./resourceDetailTypes.js";

// Re-export all types so existing consumers don't need to change their imports
export type {
  DetailFieldAction,
  DetailField,
  DetailSection,
  ResourceOperation,
  ResourceDetailPageProps,
} from "./resourceDetailTypes.js";
export { collectActionableFields } from "./resourceDetailTypes.js";

// Truncate long strings to prevent layout issues
const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
};

export function ResourceDetailPage<T>({
  resource: initialResource,
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
  pollResource,
  onPollUpdate,
  pollInterval = 3000,
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

  // Local state for resource data (updated by polling)
  const [currentResource, setCurrentResource] = React.useState(initialResource);
  const [copyStatus, setCopyStatus] = React.useState<string | null>(null);

  // Keep local resource in sync when parent provides fresher data.
  React.useEffect(() => {
    setCurrentResource(initialResource);
  }, [initialResource]);

  // Copy to clipboard with status feedback
  const handleCopy = React.useCallback(async (text: string) => {
    const status = await copyToClipboard(text);
    setCopyStatus(status);
    setTimeout(() => setCopyStatus(null), 2000);
  }, []);

  const [showDetailedInfo, setShowDetailedInfo] = React.useState(false);
  const [detailScroll, setDetailScroll] = React.useState(0);

  // Unified selectable items: actionable detail fields followed by operations.
  // Arrow keys move through the entire list seamlessly.
  const actionableFields = React.useMemo(
    () => collectActionableFields(detailSections),
    [detailSections],
  );
  const totalSelectableItems = actionableFields.length + operations.length;
  // Default selection is the first operation (skip links)
  const [selectedIndex, setSelectedIndex] = React.useState(
    actionableFields.length,
  );

  // Clamp selectedIndex when the number of selectable items shrinks
  // (e.g. operations list changes due to a status change from polling)
  React.useEffect(() => {
    if (totalSelectableItems > 0 && selectedIndex >= totalSelectableItems) {
      setSelectedIndex(totalSelectableItems - 1);
    }
  }, [totalSelectableItems, selectedIndex]);

  // Background polling for resource details
  React.useEffect(() => {
    if (!pollResource || showDetailedInfo) return;

    const interval = setInterval(async () => {
      if (isMounted.current) {
        try {
          const updatedResource = await pollResource();
          if (isMounted.current) {
            setCurrentResource(updatedResource);
            onPollUpdate?.(updatedResource);
          }
        } catch {
          // Silently ignore polling errors
        }
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [pollResource, pollInterval, showDetailedInfo, onPollUpdate]);

  // Calculate viewport for detailed info view
  const detailViewport = useViewportHeight({ overhead: 18, minHeight: 10 });

  const displayName = getDisplayName(currentResource);
  const resourceId = getId(currentResource);
  const status = getStatus(currentResource);

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

  // Helper: is the current selection on a link or an operation?
  const isOnLink = selectedIndex < actionableFields.length;
  const operationIndex = selectedIndex - actionableFields.length;

  const handleOpenInBrowser = React.useCallback(() => {
    if (!getUrl) return;
    openUrlInBrowser(getUrl(currentResource));
  }, [getUrl, currentResource]);

  const exitDetailedInfo = React.useCallback(() => {
    setShowDetailedInfo(false);
    setDetailScroll(0);
  }, []);

  const handleEnter = React.useCallback(() => {
    if (isOnLink) {
      const ref = actionableFields[selectedIndex];
      if (ref) {
        executeFieldAction(ref.action);
      }
    } else {
      const op = operations[operationIndex];
      if (op) {
        onOperation(op.key, currentResource);
      }
    }
  }, [
    isOnLink,
    actionableFields,
    selectedIndex,
    operationIndex,
    operations,
    currentResource,
    executeFieldAction,
    onOperation,
  ]);

  const inputModes: InputMode[] = React.useMemo(
    () => [
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
          c: () => handleCopy(getId(currentResource)),
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
          // Operation shortcuts work from anywhere
          const matchedOpIndex = operations.findIndex(
            (op) => op.shortcut === input,
          );
          if (matchedOpIndex !== -1) {
            setSelectedIndex(actionableFields.length + matchedOpIndex);
            onOperation(operations[matchedOpIndex].key, currentResource);
          }
        },
      },
    ],
    [
      showDetailedInfo,
      detailScroll,
      exitDetailedInfo,
      onBack,
      currentResource,
      buildDetailLines,
      selectedIndex,
      totalSelectableItems,
      handleEnter,
      getUrl,
      handleOpenInBrowser,
      operations,
      actionableFields,
      onOperation,
      getId,
    ],
  );

  useInputHandler(inputModes, { isActive: isMounted.current });

  // Detailed info mode - full screen
  if (showDetailedInfo && buildDetailLines) {
    return (
      <DetailedInfoView
        detailLines={buildDetailLines(currentResource)}
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

  // Main detail view
  return (
    <>
      <Breadcrumb
        items={[
          ...breadcrumbPrefix,
          { label: resourceType },
          { label: displayName, active: true },
        ]}
      />

      {/* Main info section */}
      <Box flexDirection="column" marginTop={1} marginBottom={1} paddingX={1}>
        <Box flexDirection="row" flexWrap="wrap">
          <Text color={colors.primary} bold>
            {truncateString(
              displayName,
              Math.max(20, detailViewport.terminalWidth - 35),
            )}
          </Text>
          {/* Only show ID separately if display name is different from ID */}
          {displayName !== resourceId && (
            <Text color={colors.idColor}> • {resourceId}</Text>
          )}
        </Box>
        <Box>
          <StatusBadge status={status} fullText />
        </Box>
      </Box>

      {/* Detail sections */}
      {detailSections.map((section, sectionIndex) => (
        <Box key={sectionIndex} flexDirection="column" marginBottom={1}>
          <Text color={section.color || colors.warning} bold>
            {section.icon || figures.squareSmallFilled} {section.title}
          </Text>
          <Box flexDirection="column" paddingLeft={2}>
            {section.fields
              .filter(
                (field) => field.value !== undefined && field.value !== null,
              )
              .map((field, fieldIndex) => {
                // Check if this field is an actionable field and whether it's selected
                const isActionable = !!field.action;
                const actionableIdx = isActionable
                  ? actionableFields.findIndex(
                      (ref) =>
                        ref.sectionIndex === sectionIndex &&
                        ref.fieldIndex === fieldIndex,
                    )
                  : -1;
                const isFieldSelected =
                  isActionable && actionableIdx === selectedIndex;

                return (
                  <Box key={fieldIndex}>
                    {isActionable ? (
                      <Text
                        color={
                          isFieldSelected ? colors.primary : colors.textDim
                        }
                      >
                        {isFieldSelected ? figures.pointer : " "}{" "}
                      </Text>
                    ) : null}
                    <Text
                      color={isFieldSelected ? colors.primary : colors.textDim}
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
          </Box>
        </Box>
      ))}

      {/* Additional content (e.g., StateHistory for devboxes) */}
      {additionalContent}

      {/* Actions section */}
      {operations.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color={colors.primary} bold>
            {figures.play} Actions
          </Text>
          <Box flexDirection="column" paddingLeft={2}>
            {operations.map((op, index) => {
              const isSelected =
                index + actionableFields.length === selectedIndex;
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
        tips={[
          { key: "Enter", label: isOnLink ? "Open Link" : "Execute" },
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

/**
 * ResourceDetailPage - Generic detail page component for resources
 * Can be used for devboxes, blueprints, snapshots, etc.
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { Header } from "./Header.js";
import { StatusBadge } from "./StatusBadge.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { colors } from "../utils/theme.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

// Types for configurable detail sections
export interface DetailField {
  label: string;
  value: string | React.ReactNode | undefined | null;
  color?: string;
}

export interface DetailSection {
  title: string;
  icon?: string;
  color?: string;
  fields: DetailField[];
}

export interface ResourceOperation {
  key: string;
  label: string;
  color: string;
  icon: string;
  shortcut: string;
}

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
  /** Optional: Polling function to refresh resource data */
  pollResource?: () => Promise<T>;
  /** Polling interval in ms (default: 3000) */
  pollInterval?: number;
}

// Format time ago in a succinct way
const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
};

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
  pollInterval = 3000,
}: ResourceDetailPageProps<T>) {
  const isMounted = React.useRef(true);

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

  // Copy to clipboard helper
  const copyToClipboard = React.useCallback(async (text: string) => {
    const { spawn } = await import("child_process");
    const platform = process.platform;

    let command: string;
    let args: string[];

    if (platform === "darwin") {
      command = "pbcopy";
      args = [];
    } else if (platform === "win32") {
      command = "clip";
      args = [];
    } else {
      command = "xclip";
      args = ["-selection", "clipboard"];
    }

    const proc = spawn(command, args);
    proc.stdin.write(text);
    proc.stdin.end();

    proc.on("exit", (code) => {
      if (code === 0) {
        setCopyStatus("Copied ID to clipboard!");
        setTimeout(() => setCopyStatus(null), 2000);
      } else {
        setCopyStatus("Failed to copy");
        setTimeout(() => setCopyStatus(null), 2000);
      }
    });

    proc.on("error", () => {
      setCopyStatus("Copy not supported");
      setTimeout(() => setCopyStatus(null), 2000);
    });
  }, []);

  const [showDetailedInfo, setShowDetailedInfo] = React.useState(false);
  const [detailScroll, setDetailScroll] = React.useState(0);
  const [selectedOperation, setSelectedOperation] = React.useState(0);

  // Background polling for resource details
  React.useEffect(() => {
    if (!pollResource || showDetailedInfo) return;

    const interval = setInterval(async () => {
      if (isMounted.current) {
        try {
          const updatedResource = await pollResource();
          if (isMounted.current) {
            setCurrentResource(updatedResource);
          }
        } catch {
          // Silently ignore polling errors
        }
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [pollResource, pollInterval, showDetailedInfo]);

  // Calculate viewport for detailed info view
  const detailViewport = useViewportHeight({ overhead: 18, minHeight: 10 });

  const displayName = getDisplayName(currentResource);
  const resourceId = getId(currentResource);
  const status = getStatus(currentResource);

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  useInput((input, key) => {
    if (!isMounted.current) return;

    // Handle detailed info mode
    if (showDetailedInfo) {
      if (input === "q" || key.escape) {
        setShowDetailedInfo(false);
        setDetailScroll(0);
      } else if (input === "j" || input === "s" || key.downArrow) {
        setDetailScroll(detailScroll + 1);
      } else if (input === "k" || input === "w" || key.upArrow) {
        setDetailScroll(Math.max(0, detailScroll - 1));
      } else if (key.pageDown) {
        setDetailScroll(detailScroll + 10);
      } else if (key.pageUp) {
        setDetailScroll(Math.max(0, detailScroll - 10));
      }
      return;
    }

    // Main view input handling
    if (input === "q" || key.escape) {
      onBack();
    } else if (input === "c" && !key.ctrl) {
      // Copy resource ID to clipboard (ignore if Ctrl+C for quit)
      copyToClipboard(getId(currentResource));
    } else if (input === "i" && buildDetailLines) {
      setShowDetailedInfo(true);
      setDetailScroll(0);
    } else if (key.upArrow && selectedOperation > 0) {
      setSelectedOperation(selectedOperation - 1);
    } else if (key.downArrow && selectedOperation < operations.length - 1) {
      setSelectedOperation(selectedOperation + 1);
    } else if (key.return) {
      const op = operations[selectedOperation];
      if (op) {
        onOperation(op.key, currentResource);
      }
    } else if (input) {
      // Check if input matches any operation shortcut
      const matchedOpIndex = operations.findIndex(
        (op) => op.shortcut === input,
      );
      if (matchedOpIndex !== -1) {
        setSelectedOperation(matchedOpIndex);
        onOperation(operations[matchedOpIndex].key, currentResource);
      }
    }

    if (input === "o" && getUrl) {
      const url = getUrl(currentResource);
      const openBrowser = async () => {
        const { exec } = await import("child_process");
        const platform = process.platform;

        let openCommand: string;
        if (platform === "darwin") {
          openCommand = `open "${url}"`;
        } else if (platform === "win32") {
          openCommand = `start "${url}"`;
        } else {
          openCommand = `xdg-open "${url}"`;
        }

        exec(openCommand);
      };
      openBrowser();
    }
  });

  // Detailed info mode - full screen
  if (showDetailedInfo && buildDetailLines) {
    const detailLines = buildDetailLines(currentResource);
    const viewportHeight = detailViewport.viewportHeight;
    const maxScroll = Math.max(0, detailLines.length - viewportHeight);
    const actualScroll = Math.min(detailScroll, maxScroll);
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
              .map((field, fieldIndex) => (
                <Box key={fieldIndex}>
                  <Text color={colors.textDim}>{field.label} </Text>
                  {typeof field.value === "string" ? (
                    <Text color={field.color} dimColor={!field.color}>
                      {field.value}
                    </Text>
                  ) : (
                    field.value
                  )}
                </Box>
              ))}
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
              const isSelected = index === selectedOperation;
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
          { key: "Enter", label: "Execute" },
          { key: "c", label: "Copy ID" },
          { key: "i", label: "Full Details", condition: !!buildDetailLines },
          { key: "o", label: "Browser", condition: !!getUrl },
          { key: "q/Ctrl+C", label: "Back/Quit" },
        ]}
      />
    </>
  );
}

// Helper to format timestamp as "time (ago)"
export function formatTimestamp(
  timestamp: number | undefined,
): string | undefined {
  if (!timestamp) return undefined;
  const formatted = new Date(timestamp).toLocaleString();
  const ago = formatTimeAgo(timestamp);
  return `${formatted} (${ago})`;
}

// Helper to format create time with arrow to end time
export function formatTimeRange(
  createTime: number | undefined,
  endTime: number | undefined,
): string | undefined {
  if (!createTime) return undefined;
  const start = new Date(createTime).toLocaleString();
  if (endTime) {
    const end = new Date(endTime).toLocaleString();
    return `${start} → ${end}`;
  }
  return `${start} (${formatTimeAgo(createTime)})`;
}

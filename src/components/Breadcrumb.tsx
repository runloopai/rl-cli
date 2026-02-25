import React from "react";
import { Box, Text, useStdout } from "ink";
import { colors } from "../utils/theme.js";
import { UpdateNotification } from "./UpdateNotification.js";

export interface BreadcrumbItem {
  label: string;
  active?: boolean;
}

/** Display mode: full (all items, border), compact (shorter labels), or minimal (active/last only) */
export type BreadcrumbCompactMode = "full" | "compact" | "minimal";

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showVersionCheck?: boolean;
  /** When set, overrides width-based mode (from vertical layout allocator) */
  compactMode?: BreadcrumbCompactMode;
}

const BREADCRUMB_FULL_MIN_WIDTH = 70;
const BREADCRUMB_COMPACT_MIN_WIDTH = 45;
const FULL_MAX_LABEL_LENGTH = 40;
const COMPACT_MAX_LABEL_LENGTH = 12;

function getModeFromWidth(
  terminalWidth: number,
  override?: BreadcrumbCompactMode,
): BreadcrumbCompactMode {
  if (override !== undefined) return override;
  if (terminalWidth >= BREADCRUMB_FULL_MIN_WIDTH) return "full";
  if (terminalWidth >= BREADCRUMB_COMPACT_MIN_WIDTH) return "compact";
  return "minimal";
}

export const Breadcrumb = ({
  items,
  showVersionCheck = false,
  compactMode: compactModeProp,
}: BreadcrumbProps) => {
  const env = process.env.RUNLOOP_ENV?.toLowerCase();
  const isDevEnvironment = env === "dev";
  const { stdout } = useStdout();

  const [terminalWidth, setTerminalWidth] = React.useState(() =>
    stdout?.columns && stdout.columns > 0 ? stdout.columns : 80,
  );

  React.useEffect(() => {
    if (!stdout) return;
    const handleResize = () => {
      const w = stdout.columns && stdout.columns > 0 ? stdout.columns : 80;
      setTerminalWidth(w);
    };
    stdout.on("resize", handleResize);
    handleResize();
    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout]);

  const mode = getModeFromWidth(terminalWidth, compactModeProp);
  const maxLabelLen =
    mode === "full"
      ? FULL_MAX_LABEL_LENGTH
      : mode === "compact"
        ? COMPACT_MAX_LABEL_LENGTH
        : Math.max(5, terminalWidth - 10);
  const showBorder = mode === "full";
  const paddingX = mode === "full" ? 2 : mode === "compact" ? 1 : 0;

  // Items to show: minimal = active or last only; compact/full = all with truncation
  const displayItems = React.useMemo(() => {
    if (mode === "minimal" && items.length > 0) {
      const active = items.find((i) => i.active) ?? items[items.length - 1];
      return [
        {
          ...active,
          label:
            active.label.length > maxLabelLen
              ? active.label.substring(0, maxLabelLen - 3) + "..."
              : active.label,
        },
      ];
    }
    return items.map((item) => ({
      ...item,
      label:
        item.label.length > maxLabelLen
          ? item.label.substring(0, maxLabelLen - 3) + "..."
          : item.label,
    }));
  }, [items, mode, maxLabelLen]);

  return (
    <Box
      justifyContent="space-between"
      marginBottom={1}
      paddingX={0}
      paddingY={0}
    >
      <Box flexShrink={0}>
        <Box
          borderStyle={showBorder ? "round" : undefined}
          borderColor={showBorder ? colors.primary : undefined}
          paddingX={paddingX}
          paddingY={0}
        >
          <Text color={colors.primary} bold>
            rl
          </Text>
          {isDevEnvironment && mode !== "minimal" && (
            <Text color={colors.error} bold>
              {" "}
              (dev)
            </Text>
          )}
          {displayItems.length > 0 && <Text color={colors.textDim}> › </Text>}
          {displayItems.map((item, index) => (
            <React.Fragment key={index}>
              <Text color={item.active ? colors.primary : colors.textDim}>
                {item.label}
              </Text>
              {index < displayItems.length - 1 && (
                <Text color={colors.textDim}> › </Text>
              )}
            </React.Fragment>
          ))}
        </Box>
      </Box>
      {showVersionCheck && <UpdateNotification />}
    </Box>
  );
};

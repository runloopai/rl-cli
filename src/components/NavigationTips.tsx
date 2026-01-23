/**
 * NavigationTips - Shared component for rendering keyboard navigation hints
 * Supports responsive display with compact format for small terminal widths
 */
import React from "react";
import { Box, Text, useStdout } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";

export interface NavigationTip {
  /** Keyboard key(s) - e.g., "Enter", "Esc", "q", "←→" */
  key?: string;
  /** Description of the action - e.g., "Select", "Back" */
  label: string;
  /** Shortened label for compact mode - auto-generated if not provided */
  compactLabel?: string;
  /** Icon to display instead of key - e.g., figures.arrowUp + figures.arrowDown */
  icon?: string;
  /** Condition for showing this tip - tip is hidden if false */
  condition?: boolean;
}

export interface NavigationTipsProps {
  /** Array of navigation tips to display */
  tips: NavigationTip[];
  /** Show arrow navigation icons (↑↓) with optional label */
  showArrows?: boolean;
  /** Label for arrow navigation (default: "Navigate") */
  arrowLabel?: string;
  /** Additional padding on the sides */
  paddingX?: number;
  /** Margin on top */
  marginTop?: number;
}

type DisplayMode = "full" | "compact" | "keysOnly";

/**
 * Map of common labels to their compact versions
 */
const COMPACT_LABELS: Record<string, string> = {
  // Navigation
  Navigate: "Nav",
  Page: "Pg",
  Top: "Top",
  Bottom: "Bot",
  // Actions
  Select: "Sel",
  Details: "Info",
  Execute: "Run",
  Continue: "OK",
  Back: "Back",
  Quit: "Quit",
  Search: "Find",
  Actions: "Act",
  Create: "New",
  Delete: "Del",
  Copy: "Cpy",
  Update: "Upd",
  Refresh: "Ref",
  // Browser/Web
  Browser: "Web",
  "Open in Browser": "Web",
  // Toggles
  "Toggle Wrap": "Wrap",
  "Full Details": "More",
  // Quick select - short version that isn't redundant with key
  "Quick select": "Jump",
};

/**
 * Get compact label - uses explicit compactLabel, then lookup, then truncates
 */
function getCompactLabel(tip: NavigationTip): string {
  if (tip.compactLabel) return tip.compactLabel;
  if (COMPACT_LABELS[tip.label]) return COMPACT_LABELS[tip.label];
  // Truncate long labels to first word or 4 chars
  if (tip.label.length > 6) {
    const firstWord = tip.label.split(" ")[0];
    return firstWord.length <= 6 ? firstWord : firstWord.slice(0, 4);
  }
  return tip.label;
}

/**
 * Shorten key for very compact display
 */
function getCompactKey(key: string): string {
  // Shorten common compound keys
  if (key === "Enter/q/esc") return "⏎/q";
  if (key === "Enter/q") return "⏎/q";
  if (key === "Enter") return "⏎";
  if (key === "Esc") return "⎋";
  return key;
}

/**
 * Calculate the width needed to render tips in a given mode
 */
function calculateWidth(
  tips: NavigationTip[],
  mode: DisplayMode,
  separator: string,
): number {
  let width = 0;
  tips.forEach((tip, index) => {
    if (index > 0) width += separator.length;
    if (tip.icon) {
      width += tip.icon.length;
      if (mode !== "keysOnly") width += 1; // space after icon
    }
    if (tip.key) {
      const keyStr = mode === "keysOnly" ? getCompactKey(tip.key) : tip.key;
      width += keyStr.length + 2; // "[key]"
      if (mode !== "keysOnly") width += 1; // space after key
    }
    if (mode === "full") {
      width += tip.label.length;
    } else if (mode === "compact") {
      width += getCompactLabel(tip).length;
    }
    // keysOnly mode adds no label width
  });
  return width;
}

/**
 * Renders a single tip based on display mode
 */
function renderTip(tip: NavigationTip, mode: DisplayMode): string {
  let result = "";
  if (tip.icon) {
    result += tip.icon;
    if (mode !== "keysOnly") result += " ";
  }
  if (tip.key) {
    const keyStr = mode === "keysOnly" ? getCompactKey(tip.key) : tip.key;
    result += `[${keyStr}]`;
    if (mode !== "keysOnly") result += " ";
  }
  if (mode === "full") {
    result += tip.label;
  } else if (mode === "compact") {
    result += getCompactLabel(tip);
  }
  return result.trimEnd();
}

/**
 * Renders a responsive navigation tips bar with compact format for small screens
 */
export const NavigationTips = ({
  tips,
  showArrows = false,
  arrowLabel = "Navigate",
  paddingX = 1,
  marginTop = 1,
}: NavigationTipsProps) => {
  const { stdout } = useStdout();

  // Get raw terminal width, responding to resize events
  const [terminalWidth, setTerminalWidth] = React.useState(() => {
    return stdout?.columns && stdout.columns > 0 ? stdout.columns : 80;
  });

  React.useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      const newWidth = stdout.columns && stdout.columns > 0 ? stdout.columns : 80;
      setTerminalWidth(newWidth);
    };

    stdout.on("resize", handleResize);
    handleResize(); // Check on mount

    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout]);

  // Filter tips by condition (undefined condition means always show)
  const visibleTips = tips.filter(
    (tip) => tip.condition === undefined || tip.condition === true,
  );

  // Build the tips array, prepending arrows if requested
  const allTips: NavigationTip[] = [];

  if (showArrows) {
    allTips.push({
      icon: `${figures.arrowUp}${figures.arrowDown}`,
      label: arrowLabel,
    });
  }

  allTips.push(...visibleTips);

  if (allTips.length === 0) {
    return null;
  }

  // Calculate available width (terminal width minus padding)
  const availableWidth = terminalWidth - paddingX * 2;

  // Determine the best display mode that fits
  const fullSeparator = " • ";
  const compactSeparator = "  ";
  const keysOnlySeparator = " ";

  let mode: DisplayMode = "full";
  let separator = fullSeparator;

  const fullWidth = calculateWidth(allTips, "full", fullSeparator);
  if (fullWidth > availableWidth) {
    // Try compact mode with shorter separator
    const compactWidth = calculateWidth(allTips, "compact", compactSeparator);
    if (compactWidth <= availableWidth) {
      mode = "compact";
      separator = compactSeparator;
    } else {
      // Fall back to keys-only mode
      const keysOnlyWidth = calculateWidth(
        allTips,
        "keysOnly",
        keysOnlySeparator,
      );
      if (keysOnlyWidth <= availableWidth) {
        mode = "keysOnly";
        separator = keysOnlySeparator;
      } else {
        // Even keys-only doesn't fit, use it anyway (best we can do)
        mode = "keysOnly";
        separator = keysOnlySeparator;
      }
    }
  }

  // Build the output string to ensure no wrapping
  const output = allTips.map((tip) => renderTip(tip, mode)).join(separator);

  return (
    <Box marginTop={marginTop} paddingX={paddingX}>
      <Text color={colors.textDim} dimColor>
        {output}
      </Text>
    </Box>
  );
};

/**
 * NavigationTips - Shared component for rendering keyboard navigation hints
 * Supports responsive wrapping for small terminal widths
 */
import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";

export interface NavigationTip {
  /** Keyboard key(s) - e.g., "Enter", "Esc", "q", "←→" */
  key?: string;
  /** Description of the action - e.g., "Select", "Back" */
  label: string;
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

/**
 * Renders a responsive navigation tips bar that wraps on small screens
 */
export const NavigationTips = ({
  tips,
  showArrows = false,
  arrowLabel = "Navigate",
  paddingX = 1,
  marginTop = 1,
}: NavigationTipsProps) => {
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

  return (
    <Box marginTop={marginTop} paddingX={paddingX} flexWrap="wrap">
      {allTips.map((tip, index) => (
        <Text key={index} color={colors.textDim} dimColor>
          {index > 0 && " • "}
          {tip.icon && `${tip.icon} `}
          {tip.key && `[${tip.key}] `}
          {tip.label}
        </Text>
      ))}
    </Box>
  );
};

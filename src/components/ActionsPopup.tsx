import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import chalk from "chalk";
import { getChalkTextColor, getChalkColor } from "../utils/theme.js";

// Generic resource type - accepts any object with an id and optional name
interface ResourceWithId {
  id: string;
  name?: string | null;
}

interface ActionsPopupProps {
  devbox: ResourceWithId;
  operations: Array<{
    key: string;
    label: string;
    color: string;
    icon: string;
    shortcut: string;
  }>;
  selectedOperation: number;
  onClose: () => void;
}

export const ActionsPopup = ({
  devbox: _devbox,
  operations,
  selectedOperation,
  onClose: _onClose,
}: ActionsPopupProps) => {
  // Calculate max width needed for content (visible characters only)
  // CRITICAL: Ensure all values are valid numbers to prevent Yoga crashes
  const maxContentWidth = Math.max(
    ...operations.map((op) => {
      const lineText = `${figures.pointer} ${op.icon} ${op.label} [${op.shortcut}]`;
      const len = lineText.length;
      return Number.isFinite(len) && len > 0 ? len : 0;
    }),
    `${figures.play} Quick Actions`.length,
    `${figures.arrowUp}${figures.arrowDown} Nav • [Enter] • [Esc] Close`.length,
    40, // Increased minimum width
  );

  // Add horizontal padding to width (2 spaces on each side = 4 total)
  // Plus 2 for border characters = 6 total extra
  // CRITICAL: Validate all computed widths are positive integers
  const contentWidth = Math.max(10, maxContentWidth + 4);

  // Get background color chalk function - use theme colors to match the theme mode
  // In light mode, use light background; in dark mode, use dark background
  const popupBgHex = getChalkColor("background");
  const popupTextHex = getChalkColor("text");
  const bgColorFn = chalk.bgHex(popupBgHex);
  const textColorFn = chalk.hex(popupTextHex);

  // Helper to create background lines with proper padding including left/right margins
  const createBgLine = (styledContent: string, plainContent: string) => {
    const visibleLength = plainContent.length;
    // CRITICAL: Validate repeat count is non-negative integer
    const repeatCount = Math.max(
      0,
      Math.floor(maxContentWidth - visibleLength),
    );
    const rightPadding = " ".repeat(repeatCount);
    // Apply background to left padding + content + right padding
    return bgColorFn("  " + styledContent + rightPadding + "  ");
  };

  // Create empty line with full background
  // CRITICAL: Validate repeat count is positive integer
  const emptyLine = bgColorFn(
    " ".repeat(Math.max(1, Math.floor(contentWidth))),
  );

  // Create border lines with background and integrated title
  const title = `${figures.play} Quick Actions`;

  // The content between ╭ and ╮ should be exactly contentWidth
  // Format: "─ title ─────"
  const titleWithSpaces = ` ${title} `;
  const titleTotalLength = titleWithSpaces.length + 1; // +1 for leading dash
  // CRITICAL: Validate repeat counts are non-negative integers
  const remainingDashes = Math.max(
    0,
    Math.floor(contentWidth - titleTotalLength),
  );

  // Use theme primary color for borders to match theme
  const borderColorFn = getChalkTextColor("primary");

  const borderTop = bgColorFn(
    borderColorFn("╭─" + titleWithSpaces + "─".repeat(remainingDashes) + "╮"),
  );
  // CRITICAL: Validate contentWidth is a positive integer
  const borderBottom = bgColorFn(
    borderColorFn(
      "╰" + "─".repeat(Math.max(1, Math.floor(contentWidth))) + "╯",
    ),
  );
  const borderSide = (content: string) => {
    return bgColorFn(borderColorFn("│") + content + borderColorFn("│"));
  };

  return (
    <Box flexDirection="column" alignItems="center">
      <Box flexDirection="column">
        <Text>{borderTop}</Text>
        <Text>{borderSide(emptyLine)}</Text>

        {operations.map((op, index) => {
          const isSelected = index === selectedOperation;
          const pointer = isSelected ? figures.pointer : " ";
          const lineText = `${pointer} ${op.icon} ${op.label} [${op.shortcut}]`;

          let styledLine: string;
          if (isSelected) {
            // Selected: use operation-specific color for icon and label
            const opColor = op.color as
              | "red"
              | "green"
              | "blue"
              | "yellow"
              | "magenta"
              | "cyan";
            const colorFn = chalk[opColor] || textColorFn;
            styledLine = `${textColorFn(pointer)} ${colorFn(op.icon)} ${colorFn.bold(op.label)} ${textColorFn(`[${op.shortcut}]`)}`;
          } else {
            // Unselected: use theme's textDim color for dimmed text
            const dimFn = getChalkTextColor("textDim");
            styledLine = `${dimFn(pointer)} ${dimFn(op.icon)} ${dimFn(op.label)} ${dimFn(`[${op.shortcut}]`)}`;
          }

          return (
            <Text key={op.key}>
              {borderSide(createBgLine(styledLine, lineText))}
            </Text>
          );
        })}

        <Text>{borderSide(emptyLine)}</Text>
        <Text>
          {borderSide(
            createBgLine(
              textColorFn(
                `${figures.arrowUp}${figures.arrowDown} Nav • [Enter] • [Esc] Close`,
              ),
              `${figures.arrowUp}${figures.arrowDown} Nav • [Enter] • [Esc] Close`,
            ),
          )}
        </Text>
        <Text>{borderSide(emptyLine)}</Text>
        <Text>{borderBottom}</Text>
      </Box>
    </Box>
  );
};

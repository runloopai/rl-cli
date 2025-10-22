import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import chalk from "chalk";
import { colors, isLightMode } from "../utils/theme.js";

interface ActionsPopupProps {
  devbox: any;
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

export const ActionsPopup: React.FC<ActionsPopupProps> = ({
  devbox,
  operations,
  selectedOperation,
  onClose,
}) => {
  // Strip ANSI codes to get actual visible length
  const stripAnsi = (str: string) => str.replace(/\u001b\[[0-9;]*m/g, "");

  // Calculate max width needed for content (visible characters only)
  const maxContentWidth = Math.max(
    ...operations.map((op) => {
      const lineText = `${figures.pointer} ${op.icon} ${op.label} [${op.shortcut}]`;
      return lineText.length;
    }),
    `${figures.play} Quick Actions`.length,
    `${figures.arrowUp}${figures.arrowDown} Nav • [Enter] • [Esc] Close`.length,
    40, // Increased minimum width
  );

  // Add horizontal padding to width (2 spaces on each side = 4 total)
  // Plus 2 for border characters = 6 total extra
  const contentWidth = maxContentWidth + 4;
  const totalWidth = contentWidth + 2; // +2 for border characters

  // Get background color chalk function - inverted for contrast
  // In light mode (light terminal), use black background for popup
  // In dark mode (dark terminal), use white background for popup
  const bgColor = isLightMode() ? chalk.bgBlack : chalk.bgWhite;
  const textColor = isLightMode() ? chalk.white : chalk.black;
  
  // Helper to create background lines with proper padding including left/right margins
  const createBgLine = (styledContent: string, plainContent: string) => {
    const visibleLength = plainContent.length;
    const rightPadding = " ".repeat(Math.max(0, maxContentWidth - visibleLength));
    // Apply background to left padding + content + right padding
    return bgColor("  " + styledContent + rightPadding + "  ");
  };

  // Create empty line with full background
  const emptyLine = bgColor(" ".repeat(contentWidth));

  // Create border lines with background and integrated title
  const title = `${figures.play} Quick Actions`;
  const titleLength = title.length;
  
  // The content between ╭ and ╮ should be exactly contentWidth
  // Format: "─ title ─────"
  const titleWithSpaces = ` ${title} `;
  const titleTotalLength = titleWithSpaces.length + 1; // +1 for leading dash
  const remainingDashes = Math.max(0, contentWidth - titleTotalLength);
  
  // Use theme primary color for borders to match theme
  const borderColorFn = isLightMode() ? chalk.cyan : chalk.blue;
  
  const borderTop = bgColor(
    borderColorFn("╭─" + titleWithSpaces + "─".repeat(remainingDashes) + "╮")
  );
  const borderBottom = bgColor(borderColorFn("╰" + "─".repeat(contentWidth) + "╯"));
  const borderSide = (content: string) => {
    return bgColor(borderColorFn("│") + content + borderColorFn("│"));
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
            const opColor = op.color as 'red' | 'green' | 'blue' | 'yellow' | 'magenta' | 'cyan';
            const colorFn = chalk[opColor] || textColor;
            styledLine = `${textColor(pointer)} ${colorFn(op.icon)} ${colorFn.bold(op.label)} ${textColor(`[${op.shortcut}]`)}`;
          } else {
            // Unselected: gray/dim text for everything
            const dimFn = isLightMode() ? chalk.gray : chalk.gray;
            styledLine = `${dimFn(pointer)} ${dimFn(op.icon)} ${dimFn(op.label)} ${dimFn(`[${op.shortcut}]`)}`;
          }
          
          return (
            <Text key={op.key}>{borderSide(createBgLine(styledLine, lineText))}</Text>
          );
        })}

        <Text>{borderSide(emptyLine)}</Text>
        <Text>
          {borderSide(createBgLine(
            textColor(`${figures.arrowUp}${figures.arrowDown} Nav • [Enter] • [Esc] Close`),
            `${figures.arrowUp}${figures.arrowDown} Nav • [Enter] • [Esc] Close`
          ))}
        </Text>
        <Text>{borderSide(emptyLine)}</Text>
        <Text>{borderBottom}</Text>
      </Box>
    </Box>
  );
};

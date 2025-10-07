import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';
import chalk from 'chalk';
import { colors } from '../utils/theme.js';

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
  // Calculate the maximum width needed
  const maxLabelLength = Math.max(...operations.map(op => op.label.length));
  const contentWidth = maxLabelLength + 12; // Content + icon + pointer + shortcuts

  // Strip ANSI codes to get real length, then pad
  const stripAnsi = (str: string) => str.replace(/\u001b\[[0-9;]*m/g, '');

  const bgLine = (content: string) => {
    const cleanLength = stripAnsi(content).length;
    const padding = Math.max(0, contentWidth - cleanLength);
    return chalk.bgBlack(content + ' '.repeat(padding));
  };

  // Render all lines with background
  const lines = [
    bgLine(chalk.hex(colors.primary).bold(` ${figures.play} Quick Actions`)),
    chalk.bgBlack(' '.repeat(contentWidth)),
    ...operations.map((op, index) => {
      const isSelected = index === selectedOperation;
      const pointer = isSelected ? figures.pointer : ' ';
      const content = ` ${pointer} ${op.icon} ${op.label} [${op.shortcut}]`;

      let styled: string;
      if (isSelected) {
        const colorFn = chalk[op.color as 'red' | 'green' | 'blue' | 'yellow' | 'magenta' | 'cyan'];
        styled = typeof colorFn === 'function' ? colorFn.bold(content) : chalk.hex(colors.text).bold(content);
      } else {
        styled = chalk.hex(colors.textDim)(content);
      }

      return bgLine(styled);
    }),
    chalk.bgBlack(' '.repeat(contentWidth)),
    bgLine(chalk.hex(colors.textDim).dim(` ${figures.arrowUp}${figures.arrowDown} Nav • [Enter]`)),
    bgLine(chalk.hex(colors.textDim).dim(` [Esc] Close`)),
  ];

  // Draw custom border with background to fill gaps
  const borderTop = chalk.hex(colors.primary)('╭' + '─'.repeat(contentWidth) + '╮');
  const borderBottom = chalk.hex(colors.primary)('╰' + '─'.repeat(contentWidth) + '╯');

  return (
    <Box flexDirection="column" alignItems="center">
      <Box flexDirection="column">
        <Text>{borderTop}</Text>
        {lines.map((line, i) => (
          <Text key={i}>{chalk.hex(colors.primary)('│')}{line}{chalk.hex(colors.primary)('│')}</Text>
        ))}
        <Text>{borderBottom}</Text>
      </Box>
    </Box>
  );
};

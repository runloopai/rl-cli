import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';
import chalk from 'chalk';

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
    bgLine(chalk.cyan.bold(` ${figures.play} Quick Actions`)),
    chalk.bgBlack(' '.repeat(contentWidth)),
    ...operations.map((op, index) => {
      const isSelected = index === selectedOperation;
      const pointer = isSelected ? figures.pointer : ' ';
      const content = ` ${pointer} ${op.icon} ${op.label} [${op.shortcut}]`;

      let styled: string;
      if (isSelected) {
        const colorFn = chalk[op.color as 'red' | 'green' | 'blue' | 'yellow' | 'magenta' | 'cyan'];
        styled = typeof colorFn === 'function' ? colorFn.bold(content) : chalk.white.bold(content);
      } else {
        styled = chalk.gray(content);
      }

      return bgLine(styled);
    }),
    chalk.bgBlack(' '.repeat(contentWidth)),
    bgLine(chalk.gray.dim(` ${figures.arrowUp}${figures.arrowDown} Nav • [Enter]`)),
    bgLine(chalk.gray.dim(` [Esc] Close`)),
  ];

  // Draw custom border with background to fill gaps
  const borderTop = chalk.cyan('╭' + '─'.repeat(contentWidth) + '╮');
  const borderBottom = chalk.cyan('╰' + '─'.repeat(contentWidth) + '╯');

  return (
    <Box flexDirection="column" alignItems="center">
      <Box flexDirection="column">
        <Text>{borderTop}</Text>
        {lines.map((line, i) => (
          <Text key={i}>{chalk.cyan('│')}{line}{chalk.cyan('│')}</Text>
        ))}
        <Text>{borderBottom}</Text>
      </Box>
    </Box>
  );
};

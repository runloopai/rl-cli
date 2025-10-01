import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="#0a4d3a">
          ▌{title}
        </Text>
        {subtitle && (
          <>
            <Text> </Text>
            <Text color="gray" dimColor>
              {subtitle}
            </Text>
          </>
        )}
      </Box>
      <Box marginLeft={1}>
        <Text color="#0a4d3a">{'─'.repeat(title.length + 1)}</Text>
      </Box>
    </Box>
  );
};

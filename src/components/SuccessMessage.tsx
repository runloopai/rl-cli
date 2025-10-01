import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';

interface SuccessMessageProps {
  message: string;
  details?: string;
}

export const SuccessMessage: React.FC<SuccessMessageProps> = ({
  message,
  details,
}) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="green" bold>
          {figures.tick} {message}
        </Text>
      </Box>
      {details && (
        <Box marginLeft={2} flexDirection="column">
          {details.split('\n').map((line, i) => (
            <Text key={i} color="gray" dimColor>
              {line}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

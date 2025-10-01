import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';

interface ErrorMessageProps {
  message: string;
  error?: Error;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, error }) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="red" bold>
          {figures.cross} {message}
        </Text>
      </Box>
      {error && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            {error.message}
          </Text>
        </Box>
      )}
    </Box>
  );
};

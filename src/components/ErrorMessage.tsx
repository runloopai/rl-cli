import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';
import { colors } from '../utils/theme.js';

interface ErrorMessageProps {
  message: string;
  error?: Error;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, error }) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={colors.error} bold>
          {figures.cross} {message}
        </Text>
      </Box>
      {error && (
        <Box marginLeft={2}>
          <Text color={colors.textDim} dimColor>
            {error.message}
          </Text>
        </Box>
      )}
    </Box>
  );
};

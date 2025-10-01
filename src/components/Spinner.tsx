import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface SpinnerComponentProps {
  message: string;
}

export const SpinnerComponent: React.FC<SpinnerComponentProps> = ({ message }) => {
  return (
    <Box marginBottom={1}>
      <Text color="cyan">
        <Spinner type="dots" />
      </Text>
      <Text> {message}</Text>
    </Box>
  );
};

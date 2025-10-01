import React from 'react';
import { Box, Text } from 'ink';

interface MetadataDisplayProps {
  metadata: Record<string, string>;
  title?: string;
}

export const MetadataDisplay: React.FC<MetadataDisplayProps> = ({ metadata, title = 'Metadata' }) => {
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column">
      <Text color="gray">{title}:</Text>
      <Box flexDirection="column" marginLeft={2}>
        {entries.map(([key, value]) => (
          <Box key={key}>
            <Text color="gray">{key}: </Text>
            <Text dimColor>{value}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

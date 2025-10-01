import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';

interface MetadataDisplayProps {
  metadata: Record<string, string>;
  title?: string;
  showBorder?: boolean;
}

export const MetadataDisplay: React.FC<MetadataDisplayProps> = ({
  metadata,
  title = 'Metadata',
  showBorder = false
}) => {
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return null;
  }

  const content = (
    <Box flexDirection="column">
      {title && (
        <Box marginBottom={1}>
          <Text color="#0a4d3a" bold>
            {figures.info} {title}
          </Text>
        </Box>
      )}
      <Box flexDirection="column" gap={0}>
        {entries.map(([key, value]) => (
          <Box key={key}>
            <Box width={20}>
              <Text color="cyan">{key}</Text>
            </Box>
            <Text color="gray"> {figures.pointerSmall} </Text>
            <Text color="white">{value}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );

  if (showBorder) {
    return (
      <Box
        borderStyle="round"
        borderColor="#0a4d3a"
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        {content}
      </Box>
    );
  }

  return content;
};

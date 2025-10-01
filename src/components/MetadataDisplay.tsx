import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';

interface MetadataDisplayProps {
  metadata: Record<string, string>;
  title?: string;
  showBorder?: boolean;
}

// Generate color for each key based on hash
const getColorForKey = (key: string, index: number): string => {
  const colors = ['cyan', 'magenta', 'yellow', 'blue', 'green', 'red'];
  return colors[index % colors.length];
};

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
    <Box flexDirection="row" alignItems="center">
      {title && (
        <>
          <Text color="#0a4d3a" bold>
            {figures.info} {title}
          </Text>
          <Text> </Text>
        </>
      )}
      {entries.map(([key, value], index) => {
        const color = getColorForKey(key, index);
        return (
          <Box key={key}>
            <Text color={color} bold>[</Text>
            <Text color={color}>{key}</Text>
            <Text color="gray">:</Text>
            <Text color="white">{value}</Text>
            <Text color={color} bold>]</Text>
            <Text> </Text>
          </Box>
        );
      })}
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

import React from 'react';
import { Box, Text } from 'ink';
import { Badge } from '@inkjs/ui';
import figures from 'figures';
import { colors } from '../utils/theme.js';

interface MetadataDisplayProps {
  metadata: Record<string, string>;
  title?: string;
  showBorder?: boolean;
  selectedKey?: string;
}

// Generate color for each key based on hash
const getColorForKey = (key: string, index: number): string => {
  const colorList = [
    colors.primary,
    colors.secondary,
    colors.warning,
    colors.info,
    colors.success,
    colors.error,
  ];
  return colorList[index % colorList.length];
};

export const MetadataDisplay: React.FC<MetadataDisplayProps> = ({
  metadata,
  title = 'Metadata',
  showBorder = false,
  selectedKey,
}) => {
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return null;
  }

  const content = (
    <Box flexDirection="row" alignItems="center" flexWrap="wrap">
      {title && (
        <>
          <Text color={colors.accent3} bold>
            {figures.info} {title}
          </Text>
          <Text> </Text>
        </>
      )}
      {entries.map(([key, value], index) => {
        const color = getColorForKey(key, index);
        const isSelected = selectedKey === key;
        return (
          <Box key={key} flexDirection="row" alignItems="center">
            {isSelected && (
              <Text color={colors.primary} bold>
                {figures.pointer}{' '}
              </Text>
            )}
            <Badge color={isSelected ? colors.primary : color}>{`${key}: ${value}`}</Badge>
          </Box>
        );
      })}
    </Box>
  );

  if (showBorder) {
    return (
      <Box
        borderStyle="round"
        borderColor={colors.accent3}
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

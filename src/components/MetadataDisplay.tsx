import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";

interface MetadataDisplayProps {
  metadata: Record<string, string>;
  title?: string;
  showBorder?: boolean;
  selectedKey?: string;
  compact?: boolean;
}

const renderKeyValueBadge = (keyText: string, value: string, color: string) => (
  <Box borderStyle="round" borderColor={color} paddingX={1} marginRight={1}>
    <Text color={color} bold>
      {keyText}
    </Text>
    <Text color={color}>: </Text>
    <Text color={color}>{value}</Text>
  </Box>
);

const renderCompactKeyValue = (
  keyText: string,
  value: string,
  color: string,
  isLast: boolean,
) => (
  <Text>
    <Text color={color} bold>
      {keyText}
    </Text>
    <Text color={colors.muted}>=</Text>
    <Text color={color}>{value}</Text>
    {!isLast && <Text color={colors.muted}> · </Text>}
  </Text>
);

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

export const MetadataDisplay = ({
  metadata,
  title = "Metadata",
  showBorder = false,
  selectedKey,
  compact = false,
}: MetadataDisplayProps) => {
  const entries = Object.entries(metadata);

  if (entries.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <Box flexDirection="column">
        {title && (
          <Text color={colors.accent3} bold>
            {figures.identical} {title}
          </Text>
        )}
        <Box flexDirection="row" flexWrap="wrap">
          {entries.map(([key, value], index) => {
            const color = getColorForKey(key, index);
            const isSelected = selectedKey === key;
            const isLast = index === entries.length - 1;
            return (
              <React.Fragment key={key}>
                {isSelected && (
                  <Text color={colors.primary} bold>
                    {figures.pointer}
                  </Text>
                )}
                {renderCompactKeyValue(
                  key,
                  value as string,
                  isSelected ? colors.primary : color,
                  isLast,
                )}
              </React.Fragment>
            );
          })}
        </Box>
      </Box>
    );
  }

  const content = (
    <Box flexDirection="row" alignItems="center" flexWrap="wrap" gap={1}>
      {title && (
        <>
          <Text color={colors.accent3} bold>
            {figures.identical} {title}
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
                {figures.pointer}{" "}
              </Text>
            )}
            {renderKeyValueBadge(
              key,
              value as string,
              isSelected ? colors.primary : color,
            )}
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

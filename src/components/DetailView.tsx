import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';

interface DetailSection {
  title: string;
  items: Array<{
    label: string;
    value: string | React.ReactNode;
    color?: string;
  }>;
}

interface DetailViewProps {
  sections: DetailSection[];
}

/**
 * Reusable detail view component for displaying entity information
 * Organizes data into sections with labeled items
 */
export const DetailView: React.FC<DetailViewProps> = ({ sections }) => {
  return (
    <Box flexDirection="column" gap={1}>
      {sections.map((section, sectionIndex) => (
        <Box key={sectionIndex} flexDirection="column">
          <Text color="yellow" bold>
            {section.title}
          </Text>
          {section.items.map((item, itemIndex) => (
            <Box key={itemIndex}>
              <Text color={item.color || 'gray'} dimColor>
                  {item.label}: {item.value}
              </Text>
            </Box>
          ))}
          {sectionIndex < sections.length - 1 && (
            <Box marginTop={1}>
              <Text> </Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
};

/**
 * Helper to build detail sections from an object
 */
export function buildDetailSections(
  data: Record<string, any>,
  config: {
    [sectionName: string]: {
      fields: Array<{
        key: string;
        label: string;
        formatter?: (value: any) => string | React.ReactNode;
        color?: string;
      }>;
    };
  }
): DetailSection[] {
  return Object.entries(config).map(([sectionName, sectionConfig]) => ({
    title: sectionName,
    items: sectionConfig.fields
      .map((field) => {
        const value = data[field.key];
        if (value === undefined || value === null) return null;

        return {
          label: field.label,
          value: field.formatter ? field.formatter(value) : String(value),
          color: field.color,
        };
      })
      .filter(Boolean) as Array<{ label: string; value: string | React.ReactNode; color?: string }>,
  })).filter((section) => section.items.length > 0);
}

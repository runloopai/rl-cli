import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';

interface BreadcrumbItem {
  label: string;
  active?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = React.memo(({ items }) => {
  const baseUrl = process.env.RUNLOOP_BASE_URL;
  const isDevEnvironment = baseUrl && baseUrl !== 'https://api.runloop.ai';

  return (
    <Box marginBottom={1} paddingX={1} paddingY={0}>
      <Text color="green" dimColor bold>RL</Text>
      {isDevEnvironment && <Text color="redBright" bold> (dev)</Text>}
      <Text> </Text>
      <Text color="gray" dimColor>{figures.arrowRight} </Text>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <Text color={item.active ? 'cyan' : 'gray'} bold={item.active} dimColor={!item.active}>
            {item.label}
          </Text>
          {index < items.length - 1 && (
            <Text color="gray" dimColor> / </Text>
          )}
        </React.Fragment>
      ))}
    </Box>
  );
});

import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import figures from 'figures';

export const Banner: React.FC = () => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Gradient colors={['#0a4d3a', '#e5f1ed']}>
        <Text bold>
          {`
╦═╗╦ ╦╔╗╔╦  ╔═╗╔═╗╔═╗
╠╦╝║ ║║║║║  ║ ║║ ║╠═╝
╩╚═╚═╝╝╚╝╩═╝╚═╝╚═╝╩ .ai
          `}
        </Text>
      </Gradient>
    </Box>
  );
};

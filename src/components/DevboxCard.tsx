import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';
import { colors } from '../utils/theme.js';

interface DevboxCardProps {
  id: string;
  name?: string;
  status: string;
  createdAt?: string;
  index?: number;
}

export const DevboxCard: React.FC<DevboxCardProps> = ({ id, name, status, createdAt }) => {
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'running':
        return { icon: figures.tick, color: colors.success };
      case 'provisioning':
      case 'initializing':
        return { icon: figures.ellipsis, color: colors.warning };
      case 'stopped':
      case 'suspended':
        return { icon: figures.circle, color: colors.textDim };
      case 'failed':
        return { icon: figures.cross, color: colors.error };
      default:
        return { icon: figures.circle, color: colors.textDim };
    }
  };

  const statusDisplay = getStatusDisplay(status);
  const displayName = name || id;

  return (
    <Box>
      <Text color={statusDisplay.color}>{statusDisplay.icon}</Text>
      <Text> </Text>
      <Box width={20}>
        <Text color={colors.primary} bold>
          {displayName.slice(0, 18)}
        </Text>
      </Box>
      <Text color={colors.textDim} dimColor>
        {id}
      </Text>
      {createdAt && (
        <>
          <Text> </Text>
          <Text color={colors.textDim} dimColor>
            {new Date(createdAt).toLocaleDateString()}
          </Text>
        </>
      )}
    </Box>
  );
};

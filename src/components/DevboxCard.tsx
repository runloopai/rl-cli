import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';

interface DevboxCardProps {
  id: string;
  name?: string;
  status: string;
  createdAt?: string;
  index?: number;
}

export const DevboxCard: React.FC<DevboxCardProps> = ({
  id,
  name,
  status,
  createdAt,
}) => {
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'running':
        return { icon: figures.tick, color: 'green' };
      case 'provisioning':
      case 'initializing':
        return { icon: figures.ellipsis, color: 'yellow' };
      case 'stopped':
      case 'suspended':
        return { icon: figures.circle, color: 'gray' };
      case 'failed':
        return { icon: figures.cross, color: 'red' };
      default:
        return { icon: figures.circle, color: 'gray' };
    }
  };

  const statusDisplay = getStatusDisplay(status);
  const displayName = name || id.slice(0, 12);
  const shortId = id.slice(0, 8);

  return (
    <Box>
      <Text color={statusDisplay.color}>{statusDisplay.icon}</Text>
      <Text> </Text>
      <Box width={20}>
        <Text color="cyan" bold>
          {displayName.slice(0, 18)}
        </Text>
      </Box>
      <Text color="gray" dimColor>
        {shortId}
      </Text>
      {createdAt && (
        <>
          <Text> </Text>
          <Text color="gray" dimColor>
            {new Date(createdAt).toLocaleDateString()}
          </Text>
        </>
      )}
    </Box>
  );
};

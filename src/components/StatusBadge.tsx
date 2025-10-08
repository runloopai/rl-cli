import React from 'react';
import { Text } from 'ink';
import figures from 'figures';
import { colors } from '../utils/theme.js';

interface StatusBadgeProps {
  status: string;
  showText?: boolean;
}

export interface StatusDisplay {
  icon: string;
  color: string;
  text: string;
}

export const getStatusDisplay = (status: string): StatusDisplay => {
  if (!status) {
    return { icon: figures.questionMarkPrefix, color: colors.textDim, text: 'UNKNOWN   ' };
  }

  switch (status) {
    case 'running':
      return { icon: figures.circleFilled, color: colors.success, text: 'RUNNING   ' };
    case 'provisioning':
      return { icon: figures.ellipsis, color: colors.warning, text: 'PROVISION ' };
    case 'initializing':
      return { icon: figures.ellipsis, color: colors.primary, text: 'INITIALIZE' };
    case 'suspended':
      return { icon: figures.circleDotted, color: colors.warning, text: 'SUSPENDED ' };
    case 'failure':
      return { icon: figures.cross, color: colors.error, text: 'FAILED    ' };
    case 'shutdown':
      return { icon: figures.circle, color: colors.textDim, text: 'SHUTDOWN  ' };
    case 'resuming':
      return { icon: figures.ellipsis, color: colors.primary, text: 'RESUMING  ' };
    case 'suspending':
      return { icon: figures.ellipsis, color: colors.warning, text: 'SUSPENDING' };
    case 'ready':
      return { icon: figures.bullet, color: colors.success, text: 'READY     ' };
    case 'build_complete':
    case 'building_complete':
      return { icon: figures.bullet, color: colors.success, text: 'COMPLETE  ' };
    case 'building':
      return { icon: figures.ellipsis, color: colors.warning, text: 'BUILDING  ' };
    case 'build_failed':
    case 'failed':
      return { icon: figures.cross, color: colors.error, text: 'FAILED    ' };
    default:
      // Truncate and pad any unknown status to 10 chars to match column width
      const truncated = status.toUpperCase().slice(0, 10);
      const padded = truncated.padEnd(10, ' ');
      return { icon: figures.questionMarkPrefix, color: colors.textDim, text: padded };
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showText = true }) => {
  const statusDisplay = getStatusDisplay(status);

  return (
    <>
      <Text color={statusDisplay.color}>{statusDisplay.icon}</Text>
      {showText && (
        <>
          <Text> </Text>
          <Text color={statusDisplay.color}>{statusDisplay.text}</Text>
        </>
      )}
    </>
  );
};

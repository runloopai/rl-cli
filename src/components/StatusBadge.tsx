import React from 'react';
import { Text } from 'ink';
import figures from 'figures';

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
  switch (status) {
    case 'running':
      return { icon: figures.circleFilled, color: 'green', text: 'RUNNING' };
    case 'provisioning':
      return { icon: figures.hamburger, color: 'yellow', text: 'PROVISIONING' };
    case 'initializing':
      return { icon: figures.ellipsis, color: 'cyan', text: 'INITIALIZING' };
    case 'suspended':
      return { icon: figures.circleDotted, color: 'yellow', text: 'SUSPENDED' };
    case 'failure':
      return { icon: figures.cross, color: 'red', text: 'FAILED' };
    case 'shutdown':
      return { icon: figures.circle, color: 'gray', text: 'SHUTDOWN' };
    case 'resuming':
      return { icon: figures.ellipsis, color: 'cyan', text: 'RESUMING' };
    case 'suspending':
      return { icon: figures.ellipsis, color: 'yellow', text: 'SUSPENDING' };
    default:
      return { icon: figures.questionMarkPrefix, color: 'gray', text: status.toUpperCase() };
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

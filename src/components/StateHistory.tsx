import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";

interface StateHistoryProps {
  stateTransitions?: any;
}

// Format time ago in a succinct way
const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
};

// Format duration in a succinct way
const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};

// Capitalize first letter of a string
const capitalize = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1);

export const StateHistory = ({ stateTransitions }: StateHistoryProps) => {
  if (!stateTransitions || !Array.isArray(stateTransitions) || stateTransitions.length === 0) {
    return null;
  }

  // Get last 3 transitions (most recent first)
  const lastThree = (stateTransitions as Array<{
    status: string;
    transition_time_ms?: number;
  }>)
    .slice(-3)
    .reverse()
    .map((transition, idx, arr) => {
      const transitionTime = transition.transition_time_ms;
      // Calculate duration: time until next transition, or until now if it's the current state
      let duration = 0;
      if (transitionTime) {
        if (idx === 0) {
          // Most recent state - duration is from transition time to now
          duration = Date.now() - transitionTime;
        } else {
          // Previous state - duration is from this transition to the next one
          const nextTransition = arr[idx - 1];
          const nextTransitionTime = nextTransition.transition_time_ms;
          if (nextTransitionTime) {
            duration = nextTransitionTime - transitionTime;
          }
        }
      }
      return {
        status: transition.status,
        transitionTime,
        duration,
      };
    })
    .filter((state) => state.transitionTime); // Only show states with valid timestamps

  if (lastThree.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Text color={colors.info} bold>
        {figures.circleFilled} State History
      </Text>
      <Box flexDirection="column">
        {lastThree.map((state, idx) => (
          <Box key={idx} flexDirection="column">
            <Text dimColor>
              {capitalize(state.status)}
              {state.transitionTime && (
                <>
                  {" "}
                  at{" "}
                  {new Date(state.transitionTime).toLocaleString()}
                  {" "}
                  <Text color={colors.textDim} dimColor>
                    ({formatTimeAgo(state.transitionTime)})
                  </Text>
                  {state.duration > 0 && (
                    <>
                      {" "}
                      • Duration:{" "}
                      <Text color={colors.info}>
                        {formatDuration(state.duration)}
                      </Text>
                    </>
                  )}
                </>
              )}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

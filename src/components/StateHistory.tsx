import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";
import { getStatusDisplay } from "./StatusBadge.js";
import { formatTimeAgo } from "../utils/time.js";
import type { DevboxView } from "@runloop/api-client/resources/devboxes/devboxes";

type DevboxStatus = DevboxView["status"];
type StateTransition = DevboxView.StateTransition;

interface StateHistoryProps {
  stateTransitions?: StateTransition[];
  shutdownReason?: string;
}

// Format shutdown reason into human-readable text
const formatShutdownReason = (reason: string): string => {
  switch (reason) {
    case "api_shutdown":
      return "API call";
    case "idle_timeout":
      return "Idle timeout";
    case "keep_alive_timeout":
      return "Max lifetime expired";
    case "max_lifetime":
    case "max_lifetime_exceeded":
      return "Max lifetime exceeded";
    case "user_initiated":
      return "User initiated";
    case "system_maintenance":
      return "System maintenance";
    case "resource_limit":
      return "Resource limits";
    case "entrypoint_exit":
      return "Entrypoint exited";
    case "idle":
      return "Idle";
    case "error":
    case "failure":
      return "Error";
    default:
      // Convert snake_case to readable text
      return reason.replace(/_/g, " ");
  }
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
const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

// Terminal states that don't need duration shown (no new state coming)
const TERMINAL_STATES: DevboxStatus[] = ["shutdown", "failure"];

export const StateHistory = ({
  stateTransitions,
  shutdownReason,
}: StateHistoryProps) => {
  if (!stateTransitions || stateTransitions.length === 0) {
    return null;
  }

  // Check if there are more than 5 transitions
  const totalTransitions = stateTransitions.length;
  const hasMore = totalTransitions > 5;

  // Get last 5 transitions (oldest first - chronological order)
  const lastFive = stateTransitions
    .slice(-5)
    .map((transition, idx, arr) => {
      const transitionTime = transition.transition_time_ms as
        | number
        | undefined;
      // Calculate duration: time until next transition, or until now if it's the last state
      let duration = 0;
      if (transitionTime) {
        if (idx === arr.length - 1) {
          // Most recent state - duration is from transition time to now
          duration = Date.now() - transitionTime;
        } else {
          // Earlier state - duration is from this transition to the next one
          const nextTransition = arr[idx + 1];
          const nextTransitionTime = nextTransition.transition_time_ms as
            | number
            | undefined;
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

  if (lastFive.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={colors.success} bold>
        {figures.info} State History
        {hasMore && (
          <Text color={colors.textDim} dimColor>
            {" "}
            ({totalTransitions - 5} earlier)
          </Text>
        )}
      </Text>
      <Box flexDirection="column" paddingLeft={2}>
        {lastFive.map((state, idx) => {
          const statusDisplay = getStatusDisplay(state.status || "");
          const isLastState = idx === lastFive.length - 1;
          const isTerminalState = TERMINAL_STATES.includes(
            state.status as DevboxStatus,
          );
          const showDuration =
            state.duration > 0 && !(isLastState && isTerminalState);
          const isShutdownState = state.status === "shutdown";

          return (
            <Box key={idx} flexDirection="row">
              <Text color={statusDisplay.color}>{statusDisplay.icon} </Text>
              <Text
                color={isLastState ? statusDisplay.color : colors.textDim}
                bold={isLastState}
              >
                {capitalize(state.status || "unknown")}
              </Text>
              {state.transitionTime && (
                <>
                  <Text dimColor>
                    {" "}
                    at {new Date(state.transitionTime).toLocaleString()}{" "}
                    <Text color={colors.textDim}>
                      ({formatTimeAgo(state.transitionTime)})
                    </Text>
                    {showDuration && (
                      <>
                        {" "}
                        • Duration:{" "}
                        <Text color={colors.secondary}>
                          {formatDuration(state.duration)}
                        </Text>
                      </>
                    )}
                  </Text>
                  {isShutdownState && shutdownReason && (
                    <>
                      <Text color={colors.textDim}> due to </Text>
                      <Text color={colors.warning}>
                        {formatShutdownReason(shutdownReason)}
                      </Text>
                    </>
                  )}
                </>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";
import { getStatusDisplay } from "./StatusBadge.js";
import { formatTimeAgo } from "../utils/time.js";
import type { DevboxView } from "@runloop/api-client/resources/devboxes/devboxes";
import type { DetailSection } from "./resourceDetailTypes.js";

type DevboxStatus = DevboxView["status"];
type StateTransition = DevboxView.StateTransition;

interface StateHistoryProps {
  stateTransitions?: StateTransition[];
  shutdownReason?: string;
}

/** Processed transition for display (used by section builder and component) */
export interface ProcessedTransition {
  status: string | undefined;
  transitionTime: number;
  duration: number;
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

/**
 * Process raw state transitions into display form (status, time, duration).
 * Uses all transitions so section allocation can truncate how many to show.
 */
export function processStateTransitions(
  stateTransitions: StateTransition[] | undefined,
): ProcessedTransition[] {
  if (!stateTransitions || stateTransitions.length === 0) return [];
  const result: ProcessedTransition[] = [];
  for (let idx = 0; idx < stateTransitions.length; idx++) {
    const transition = stateTransitions[idx];
    const transitionTime = transition.transition_time_ms as number | undefined;
    if (transitionTime == null) continue;
    let duration = 0;
    if (idx === stateTransitions.length - 1) {
      duration = Date.now() - transitionTime;
    } else {
      const nextTransition = stateTransitions[idx + 1];
      const nextTransitionTime = nextTransition.transition_time_ms as
        | number
        | undefined;
      if (nextTransitionTime != null) {
        duration = nextTransitionTime - transitionTime;
      }
    }
    result.push({
      status: transition.status,
      transitionTime,
      duration,
    });
  }
  return result;
}

/** Render a single state transition row (shared by section fields and legacy component). */
function renderStateRow(
  state: ProcessedTransition,
  isLastState: boolean,
  shutdownReason: string | undefined,
): React.ReactElement {
  const statusDisplay = getStatusDisplay(state.status || "");
  const isTerminalState = TERMINAL_STATES.includes(
    state.status as DevboxStatus,
  );
  const showDuration = state.duration > 0 && !(isLastState && isTerminalState);
  const isShutdownState = state.status === "shutdown";

  return (
    <Box flexDirection="row" flexWrap="nowrap">
      <Text color={statusDisplay.color}>{statusDisplay.icon} </Text>
      <Text
        color={isLastState ? statusDisplay.color : colors.textDim}
        bold={isLastState}
      >
        {capitalize(state.status || "unknown")}
      </Text>
      <Text dimColor>
        {" "}
        at {new Date(state.transitionTime).toLocaleString()}{" "}
        <Text color={colors.textDim}>
          ({formatTimeAgo(state.transitionTime)})
        </Text>
        {showDuration && (
          <Text>
            {" "}
            • Duration:{" "}
            <Text color={colors.secondary}>
              {formatDuration(state.duration)}
            </Text>
          </Text>
        )}
      </Text>
      {isShutdownState && shutdownReason && (
        <Text>
          <Text color={colors.textDim}> due to </Text>
          <Text color={colors.warning}>
            {formatShutdownReason(shutdownReason)}
          </Text>
        </Text>
      )}
    </Box>
  );
}

/**
 * Build a DetailSection for State History so it participates in section allocation.
 * When the viewport is small, only the first N transitions are shown and
 * "View rest of State History" appears; Enter opens the full section view.
 */
export function buildStateHistorySection(
  stateTransitions: StateTransition[] | undefined,
  shutdownReason?: string,
): DetailSection | null {
  const processed = processStateTransitions(stateTransitions);
  if (processed.length === 0) return null;

  const fields = processed.map((state, idx) => ({
    label: "",
    value: renderStateRow(state, idx === processed.length - 1, shutdownReason),
  }));

  return {
    title: "State History",
    icon: figures.info,
    color: colors.success,
    fields,
  };
}

export const StateHistory = ({
  stateTransitions,
  shutdownReason,
}: StateHistoryProps) => {
  const processed = processStateTransitions(stateTransitions);
  const lastFive = processed.slice(-5);
  if (lastFive.length === 0) return null;

  const totalTransitions = processed.length;
  const hasMore = totalTransitions > 5;

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
        {lastFive.map((state, idx) => (
          <React.Fragment key={state.transitionTime}>
            {renderStateRow(state, idx === lastFive.length - 1, shutdownReason)}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};

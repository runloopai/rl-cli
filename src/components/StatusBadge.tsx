import React from "react";
import { Text } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";

interface StatusBadgeProps {
  status: string;
  showText?: boolean;
  /** Show full human-readable text instead of truncated table column text */
  fullText?: boolean;
}

export interface StatusDisplay {
  icon: string;
  color: string;
  /** Truncated/padded text for table columns (10 chars) */
  text: string;
  /** Full human-readable status text */
  label: string;
}

export const getStatusDisplay = (status: string): StatusDisplay => {
  if (!status) {
    return {
      icon: figures.questionMarkPrefix,
      color: colors.textDim,
      text: "UNKNOWN   ",
      label: "Unknown",
    };
  }

  switch (status) {
    // === ACTIVE STATE ===
    case "running":
      return {
        icon: figures.circleFilled,
        color: colors.success,
        text: "RUNNING   ",
        label: "Running",
      };

    // === STARTING UP (transitioning to active) ===
    case "provisioning":
      return {
        icon: figures.arrowUp,
        color: colors.warning,
        text: "PROVISION ",
        label: "Provisioning",
      };
    case "initializing":
      return {
        icon: figures.arrowUp,
        color: colors.primary,
        text: "INITIALIZE",
        label: "Initializing",
      };
    case "resuming":
      return {
        icon: figures.arrowUp,
        color: colors.primary,
        text: "RESUMING  ",
        label: "Resuming",
      };

    // === SHUTTING DOWN (transitioning to inactive) ===
    case "suspending":
      return {
        icon: figures.arrowDown,
        color: colors.warning,
        text: "SUSPENDING",
        label: "Suspending",
      };

    // === INACTIVE STATES ===
    case "suspended":
      return {
        icon: figures.circleDotted,
        color: colors.warning,
        text: "SUSPENDED ",
        label: "Suspended",
      };
    case "shutdown":
      return {
        icon: figures.circle,
        color: colors.textDim,
        text: "SHUTDOWN  ",
        label: "Shutdown",
      };

    // === ERROR STATES ===
    case "failure":
      return {
        icon: figures.warning,
        color: colors.error,
        text: "FAILED    ",
        label: "Failed",
      };
    case "build_failed":
    case "failed":
      return {
        icon: figures.warning,
        color: colors.error,
        text: "FAILED    ",
        label: "Failed",
      };

    // === BUILD STATES (for blueprints) ===
    case "ready":
      return {
        icon: figures.tick,
        color: colors.success,
        text: "READY     ",
        label: "Ready",
      };
    case "build_complete":
    case "building_complete":
      return {
        icon: figures.tick,
        color: colors.success,
        text: "COMPLETE  ",
        label: "Build Complete",
      };
    case "building":
      return {
        icon: figures.arrowUp,
        color: colors.warning,
        text: "BUILDING  ",
        label: "Building: In Progress",
      };

    // === BENCHMARK/SCENARIO STATES ===
    case "completed":
      return {
        icon: figures.tick,
        color: colors.success,
        text: "COMPLETED ",
        label: "Completed",
      };
    case "canceled":
      return {
        icon: figures.cross,
        color: colors.textDim,
        text: "CANCELED  ",
        label: "Canceled",
      };
    case "scoring":
      return {
        icon: figures.arrowUp,
        color: colors.warning,
        text: "SCORING   ",
        label: "Scoring",
      };
    case "scored":
      return {
        icon: figures.tick,
        color: colors.info,
        text: "SCORED    ",
        label: "Scored",
      };
    case "timeout":
      return {
        icon: figures.warning,
        color: colors.error,
        text: "TIMEOUT   ",
        label: "Timeout",
      };

    // === GENERIC STATES ===
    case "active":
      return {
        icon: figures.tick,
        color: colors.success,
        text: "ACTIVE    ",
        label: "Active",
      };

    // === STORAGE OBJECT STATES ===
    case "UPLOADING":
      return {
        icon: figures.arrowUp,
        color: colors.warning,
        text: "UPLOADING ",
        label: "Uploading",
      };
    case "READ_ONLY":
      return {
        icon: figures.tick,
        color: colors.success,
        text: "READ_ONLY ",
        label: "Read Only",
      };
    case "DELETED":
      return {
        icon: figures.cross,
        color: colors.textDim,
        text: "DELETED   ",
        label: "Deleted",
      };
    case "ERROR":
      return {
        icon: figures.warning,
        color: colors.error,
        text: "ERROR     ",
        label: "Error",
      };

    default:
      // Truncate and pad any unknown status to 10 chars to match column width
      const truncated = status.toUpperCase().slice(0, 10);
      const padded = truncated.padEnd(10, " ");
      // Capitalize first letter for label
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      return {
        icon: figures.questionMarkPrefix,
        color: colors.textDim,
        text: padded,
        label: label,
      };
  }
};

export const StatusBadge = ({
  status,
  showText = true,
  fullText = false,
}: StatusBadgeProps) => {
  const statusDisplay = getStatusDisplay(status);
  const displayText = fullText ? statusDisplay.label : statusDisplay.text;

  return (
    <>
      <Text color={statusDisplay.color}>{statusDisplay.icon}</Text>
      {showText && (
        <>
          <Text> </Text>
          <Text color={statusDisplay.color}>{displayText}</Text>
        </>
      )}
    </>
  );
};

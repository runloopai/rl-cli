import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";

interface UpdateNotificationProps {
  message?: string;
  command?: string;
}

export const UpdateNotification = ({
  message = "A new version of the CLI is available!",
  command = "npm install -g @runloop/rl-cli",
}: UpdateNotificationProps) => {
  // Use warning color for the main message - it's already theme-aware
  const warningColor = colors.warning;
  const primaryColor = colors.primary;

  return (
    <Box
      flexDirection="column"
      marginY={1}
      borderStyle="round"
      borderColor={warningColor}
      paddingX={1}
      paddingY={1}
    >
      {/* Header with icon and message - make it very prominent */}
      <Box flexDirection="row" alignItems="center">
        <Text color={warningColor} bold>
          {figures.warning} {figures.warning} {figures.warning}
        </Text>
        <Text> </Text>
        <Text color={warningColor} bold>
          {message}
        </Text>
      </Box>

      {/* Command box with double border for emphasis */}
      <Box marginTop={1} flexDirection="column">
        <Box
          borderStyle="double"
          borderColor={primaryColor}
          paddingX={1}
          paddingY={0}
        >
          <Text color={primaryColor} bold>
            {figures.pointer} {command}
          </Text>
        </Box>
      </Box>

      {/* Additional info */}
      <Box marginTop={1}>
        <Text color={colors.textDim} dimColor>
          Run this command to update to the latest version
        </Text>
      </Box>
    </Box>
  );
};


import React from "react";
import { Box, Text } from "ink";
import { colors } from "../utils/theme.js";
import { useUpdateCheck } from "../hooks/useUpdateCheck.js";

/**
 * Version check component that checks npm for updates and displays a notification
 * Restored from git history and enhanced with better visual styling
 */
export const UpdateNotification: React.FC = () => {
  const { isChecking, updateAvailable, currentVersion } = useUpdateCheck();

  if (isChecking || !updateAvailable) {
    return null;
  }

  return (
    <Box>
      <Box
        borderStyle="arrow"
        borderColor={colors.warning}
        paddingX={1}
        paddingY={0}
      >
        <Text color={colors.warning}>✨</Text>
        <Text color={colors.text}> Update available: </Text>
        <Text color={colors.warning}>{currentVersion}</Text>
        <Text color={colors.primary}> → </Text>
        <Text color={colors.success}>{updateAvailable}</Text>
        <Text color={colors.textDim}> • Press </Text>
        <Text color={colors.primary} bold>
          [u]
        </Text>
        <Text color={colors.textDim}> to run: </Text>
        <Text color={colors.textDim} dimColor>
          npm i -g @runloop/rl-cli@latest
        </Text>
      </Box>
    </Box>
  );
};

import React from "react";
import { Box, Text } from "ink";
import { colors } from "../utils/theme.js";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  // Limit lengths to prevent Yoga layout engine errors
  const MAX_TITLE_LENGTH = 100;
  const MAX_SUBTITLE_LENGTH = 150;

  const truncatedTitle =
    title.length > MAX_TITLE_LENGTH
      ? title.substring(0, MAX_TITLE_LENGTH) + "..."
      : title;

  const truncatedSubtitle =
    subtitle && subtitle.length > MAX_SUBTITLE_LENGTH
      ? subtitle.substring(0, MAX_SUBTITLE_LENGTH) + "..."
      : subtitle;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={colors.accent3}>
          ▌{truncatedTitle}
        </Text>
        {truncatedSubtitle && (
          <>
            <Text> </Text>
            <Text color={colors.textDim} dimColor>
              {truncatedSubtitle}
            </Text>
          </>
        )}
      </Box>
      <Box marginLeft={1}>
        <Text color={colors.accent3}>
          {"─".repeat(
            Math.min(truncatedTitle.length + 1, MAX_TITLE_LENGTH + 1),
          )}
        </Text>
      </Box>
    </Box>
  );
};

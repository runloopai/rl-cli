import React from "react";
import { Box, Text } from "ink";
import { colors } from "../utils/theme.js";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={colors.accent3}>
          ▌{title}
        </Text>
        {subtitle && (
          <>
            <Text> </Text>
            <Text color={colors.textDim} dimColor>
              {subtitle}
            </Text>
          </>
        )}
      </Box>
      <Box marginLeft={1}>
        <Text color={colors.accent3}>{"─".repeat(title.length + 1)}</Text>
      </Box>
    </Box>
  );
};

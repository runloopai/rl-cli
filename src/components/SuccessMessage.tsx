import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";

interface SuccessMessageProps {
  message: string;
  details?: string;
}

export const SuccessMessage: React.FC<SuccessMessageProps> = ({
  message,
  details,
}) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={colors.success} bold>
          {figures.tick} {message}
        </Text>
      </Box>
      {details && (
        <Box marginLeft={2} flexDirection="column">
          {details.split("\n").map((line, i) => (
            <Text key={i} color={colors.textDim} dimColor>
              {line}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

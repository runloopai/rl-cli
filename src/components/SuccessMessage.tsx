import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";

interface SuccessMessageProps {
  message: string;
  details?: string;
}

export const SuccessMessage = ({
  message,
  details,
}: SuccessMessageProps) => {
  // Limit message length to prevent Yoga layout engine errors
  const MAX_LENGTH = 500;
  const truncatedMessage =
    message.length > MAX_LENGTH
      ? message.substring(0, MAX_LENGTH) + "..."
      : message;

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={colors.success} bold>
          {figures.tick} {truncatedMessage}
        </Text>
      </Box>
      {details && (
        <Box marginLeft={2} flexDirection="column">
          {details.split("\n").map((line, i) => {
            const truncatedLine =
              line.length > MAX_LENGTH
                ? line.substring(0, MAX_LENGTH) + "..."
                : line;
            return (
              <Text key={i} color={colors.textDim} dimColor>
                {truncatedLine}
              </Text>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

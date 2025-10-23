import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";

interface ErrorMessageProps {
  message: string;
  error?: Error;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  error,
}) => {
  // Limit message length to prevent Yoga layout engine errors
  const MAX_LENGTH = 500;
  const truncatedMessage =
    message.length > MAX_LENGTH
      ? message.substring(0, MAX_LENGTH) + "..."
      : message;
  const truncatedError =
    error?.message && error.message.length > MAX_LENGTH
      ? error.message.substring(0, MAX_LENGTH) + "..."
      : error?.message;

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={colors.error} bold>
          {figures.cross} {truncatedMessage}
        </Text>
      </Box>
      {truncatedError && (
        <Box marginLeft={2}>
          <Text color={colors.textDim} dimColor>
            {truncatedError}
          </Text>
        </Box>
      )}
    </Box>
  );
};

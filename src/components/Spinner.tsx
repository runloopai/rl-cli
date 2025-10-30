import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { colors } from "../utils/theme.js";

interface SpinnerComponentProps {
  message: string;
}

export const SpinnerComponent = ({
  message,
}: SpinnerComponentProps) => {
  // Limit message length to prevent Yoga layout engine errors
  const MAX_LENGTH = 200;
  const truncatedMessage =
    message.length > MAX_LENGTH
      ? message.substring(0, MAX_LENGTH) + "..."
      : message;

  return (
    <Box marginBottom={1}>
      <Text color={colors.primary}>
        <Spinner type="dots" />
      </Text>
      <Text> {truncatedMessage}</Text>
    </Box>
  );
};

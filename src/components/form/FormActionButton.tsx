/**
 * FormActionButton - Action button for forms (like "Create")
 */
import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../../utils/theme.js";

export interface FormActionButtonProps {
  label: string;
  isActive: boolean;
  hint?: string;
}

export const FormActionButton = ({
  label,
  isActive,
  hint = "[Enter to execute]",
}: FormActionButtonProps) => {
  return (
    <Box marginBottom={0}>
      <Text color={isActive ? colors.success : colors.textDim} bold={isActive}>
        {isActive ? figures.pointer : " "} {label}
      </Text>
      {isActive && (
        <Text color={colors.textDim} dimColor>
          {" "}
          {hint}
        </Text>
      )}
    </Box>
  );
};

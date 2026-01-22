/**
 * FormField - Base wrapper for form fields with label, active state, and pointer indicator
 */
import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../../utils/theme.js";

export interface FormFieldProps {
  label: string;
  isActive: boolean;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}

export const FormField = ({
  label,
  isActive,
  children,
  hint,
  error,
}: FormFieldProps) => {
  return (
    <Box marginBottom={0}>
      <Text color={error ? colors.error : isActive ? colors.primary : colors.textDim}>
        {isActive ? figures.pointer : " "} {label}:{" "}
      </Text>
      {children}
      {error && (
        <Text color={colors.error}>
          {" "}
          {figures.cross} {error}
        </Text>
      )}
      {hint && isActive && !error && (
        <Text color={colors.textDim} dimColor>
          {" "}
          {hint}
        </Text>
      )}
    </Box>
  );
};

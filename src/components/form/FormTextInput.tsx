/**
 * FormTextInput - Text input field for forms
 */
import React from "react";
import { Text } from "ink";
import TextInput from "ink-text-input";
import { FormField } from "./FormField.js";
import { colors } from "../../utils/theme.js";

export interface FormTextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isActive: boolean;
  placeholder?: string;
  error?: string;
  /** Called when Enter is pressed in the text input */
  onSubmit?: () => void;
  /** Character to mask input with (e.g., "*" for passwords) */
  mask?: string;
}

export const FormTextInput = ({
  label,
  value,
  onChange,
  isActive,
  placeholder,
  error,
  onSubmit,
  mask,
}: FormTextInputProps) => {
  // Display value: use mask character if provided
  const displayValue = mask && value ? mask.repeat(value.length) : value;

  return (
    <FormField label={label} isActive={isActive} error={error}>
      {isActive ? (
        <TextInput
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          onSubmit={onSubmit}
          mask={mask}
        />
      ) : (
        <Text color={error ? colors.error : colors.text}>
          {displayValue || "(empty)"}
        </Text>
      )}
    </FormField>
  );
};

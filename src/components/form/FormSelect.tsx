/**
 * FormSelect - Left/right arrow selection field for forms
 */
import React from "react";
import { Text } from "ink";
import figures from "figures";
import { FormField } from "./FormField.js";
import { colors } from "../../utils/theme.js";

export interface FormSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  isActive: boolean;
  getDisplayLabel?: (value: T) => string;
}

export function FormSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  isActive,
  getDisplayLabel,
}: FormSelectProps<T>) {
  const displayValue = getDisplayLabel ? getDisplayLabel(value) : value;

  return (
    <FormField
      label={label}
      isActive={isActive}
      hint={`[${figures.arrowLeft}${figures.arrowRight} to change]`}
    >
      <Text color={isActive ? colors.primary : colors.text} bold={isActive}>
        {displayValue || "(none)"}
      </Text>
    </FormField>
  );
}

/**
 * Helper hook to handle left/right arrow navigation for select fields
 */
export function useFormSelectNavigation<T extends string>(
  value: T,
  options: readonly T[],
  onChange: (value: T) => void,
  isActive: boolean,
) {
  const handleInput = React.useCallback(
    (input: string, key: { leftArrow: boolean; rightArrow: boolean }) => {
      if (!isActive) return false;

      if (key.leftArrow || key.rightArrow) {
        const currentIndex = options.indexOf(value);
        const safeIndex = currentIndex === -1 ? 0 : currentIndex;
        // Wrap around: left from first goes to last, right from last goes to first
        const newIndex = key.leftArrow
          ? (safeIndex - 1 + options.length) % options.length
          : (safeIndex + 1) % options.length;
        onChange(options[newIndex]);
        return true;
      }
      return false;
    },
    [value, options, onChange, isActive],
  );

  return handleInput;
}

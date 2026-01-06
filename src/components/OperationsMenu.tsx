import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors } from "../utils/theme.js";

export interface Operation {
  key: string;
  label: string;
  color: string;
  icon: string;
  needsInput?: boolean;
  inputPrompt?: string;
  inputPlaceholder?: string;
}

interface OperationsMenuProps {
  operations: Operation[];
  selectedIndex: number;
  onNavigate: (direction: "up" | "down") => void;
  onSelect: (operation: Operation) => void;
  onBack: () => void;
  additionalActions?: Array<{
    key: string;
    label: string;
    handler: () => void;
  }>;
}

/**
 * Reusable operations menu component for detail pages
 * Displays a list of available operations with keyboard navigation
 */
export const OperationsMenu = ({
  operations,
  selectedIndex,
  onNavigate: _onNavigate,
  onSelect: _onSelect,
  onBack: _onBack,
  additionalActions = [],
}: OperationsMenuProps) => {
  return (
    <>
      {/* Operations List */}
      <Box flexDirection="column">
        <Text color={colors.primary} bold>
          {figures.play} Operations
        </Text>
        <Box flexDirection="column">
          {operations.map((op, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box key={op.key}>
                <Text color={isSelected ? colors.primary : colors.textDim}>
                  {isSelected ? figures.pointer : " "}{" "}
                </Text>
                <Text
                  color={isSelected ? op.color : colors.textDim}
                  bold={isSelected}
                >
                  {op.icon} {op.label}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Help text */}
      <Box marginTop={1}>
        <Text color={colors.textDim} dimColor>
          {figures.arrowUp}
          {figures.arrowDown} Navigate • [Enter] Select •
          {additionalActions.map(
            (action) => ` [${action.key}] ${action.label} •`,
          )}{" "}
          [q] Back
        </Text>
      </Box>
    </>
  );
};

/**
 * Helper to filter operations based on conditions
 */
export function filterOperations(
  allOperations: Operation[],
  condition: (op: Operation) => boolean,
): Operation[] {
  return allOperations.filter(condition);
}

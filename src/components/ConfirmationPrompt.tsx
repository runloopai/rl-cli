/**
 * ConfirmationPrompt - Reusable confirmation dialog for destructive actions
 */
import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";
import { Header } from "./Header.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { colors } from "../utils/theme.js";

export interface ConfirmationPromptProps {
  /** Title for the confirmation page */
  title: string;
  /** Main message to display */
  message: string;
  /** Optional additional details */
  details?: string;
  /** Breadcrumb items */
  breadcrumbItems?: Array<{ label: string; active?: boolean }>;
  /** Callback when confirmed (Yes selected) */
  onConfirm: () => void;
  /** Callback when cancelled (No selected or escape) */
  onCancel: () => void;
  /** Label for confirm button (default: "Yes, delete") */
  confirmLabel?: string;
  /** Label for cancel button (default: "No, cancel") */
  cancelLabel?: string;
  /** Color for confirm button (default: error/red) */
  confirmColor?: string;
}

export const ConfirmationPrompt = ({
  title,
  message,
  details,
  breadcrumbItems,
  onConfirm,
  onCancel,
  confirmLabel = "Yes, delete",
  cancelLabel = "No, cancel",
  confirmColor = colors.error,
}: ConfirmationPromptProps) => {
  // Default to "No" (index 1)
  const [selectedIndex, setSelectedIndex] = React.useState(1);

  useInput((input, key) => {
    if (key.upArrow || key.leftArrow) {
      setSelectedIndex(0);
    } else if (key.downArrow || key.rightArrow) {
      setSelectedIndex(1);
    } else if (key.return) {
      if (selectedIndex === 0) {
        onConfirm();
      } else {
        onCancel();
      }
    } else if (key.escape || input === "q") {
      onCancel();
    } else if (input === "y" || input === "Y") {
      onConfirm();
    } else if (input === "n" || input === "N") {
      onCancel();
    }
  });

  return (
    <>
      {breadcrumbItems && <Breadcrumb items={breadcrumbItems} />}
      <Header title={title} />

      <Box flexDirection="column" marginTop={1} paddingX={1}>
        <Box marginBottom={1}>
          <Text color={colors.warning}>
            {figures.warning} {message}
          </Text>
        </Box>

        {details && (
          <Box marginBottom={1}>
            <Text color={colors.textDim} dimColor>
              {details}
            </Text>
          </Box>
        )}

        <Box flexDirection="column" marginTop={1}>
          {/* Yes option */}
          <Box>
            <Text color={selectedIndex === 0 ? confirmColor : colors.textDim}>
              {selectedIndex === 0 ? figures.pointer : " "}{" "}
            </Text>
            <Text
              color={selectedIndex === 0 ? confirmColor : colors.textDim}
              bold={selectedIndex === 0}
            >
              {confirmLabel}
            </Text>
            <Text color={colors.textDim} dimColor>
              {" "}
              [y]
            </Text>
          </Box>

          {/* No option (default) */}
          <Box>
            <Text color={selectedIndex === 1 ? colors.success : colors.textDim}>
              {selectedIndex === 1 ? figures.pointer : " "}{" "}
            </Text>
            <Text
              color={selectedIndex === 1 ? colors.success : colors.textDim}
              bold={selectedIndex === 1}
            >
              {cancelLabel}
            </Text>
            <Text color={colors.textDim} dimColor>
              {" "}
              [n]
            </Text>
          </Box>
        </Box>

        <NavigationTips
          showArrows
          arrowLabel="Select"
          marginTop={1}
          paddingX={0}
          tips={[
            { key: "Enter", label: "Confirm" },
            { key: "y/n", label: "Quick select" },
            { key: "Esc", label: "Cancel" },
          ]}
        />
      </Box>
    </>
  );
};

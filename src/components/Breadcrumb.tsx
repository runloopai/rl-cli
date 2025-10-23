import React from "react";
import { Box, Text } from "ink";
import { colors } from "../utils/theme.js";

export interface BreadcrumbItem {
  label: string;
  active?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  const env = process.env.RUNLOOP_ENV?.toLowerCase();
  const isDevEnvironment = env === "dev";

  return (
    <Box marginBottom={1} paddingX={1} paddingY={0}>
      <Box
        borderStyle="round"
        borderColor={colors.primary}
        paddingX={2}
        paddingY={0}
      >
        <Text color={colors.primary} bold>
          rl
        </Text>
        {isDevEnvironment && (
          <Text color={colors.error} bold>
            {" "}
            (dev)
          </Text>
        )}
        <Text color={colors.textDim}> › </Text>
        {items.map((item, index) => {
          // Limit label length to prevent Yoga layout engine errors
          const MAX_LABEL_LENGTH = 80;
          const truncatedLabel =
            item.label.length > MAX_LABEL_LENGTH
              ? item.label.substring(0, MAX_LABEL_LENGTH) + "..."
              : item.label;

          return (
            <React.Fragment key={index}>
              <Text color={item.active ? colors.primary : colors.textDim}>
                {truncatedLabel}
              </Text>
              {index < items.length - 1 && (
                <Text color={colors.textDim}> › </Text>
              )}
            </React.Fragment>
          );
        })}
      </Box>
    </Box>
  );
};

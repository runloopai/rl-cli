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

export const Breadcrumb: React.FC<BreadcrumbProps> = React.memo(({ items }) => {
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
          <Text color="redBright" bold>
            {" "}
            (dev)
          </Text>
        )}
        <Text color={colors.textDim} dimColor>
          {" "}
          ›{" "}
        </Text>
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <Text
              color={item.active ? colors.text : colors.textDim}
              bold={item.active}
              dimColor={!item.active}
            >
              {item.label}
            </Text>
            {index < items.length - 1 && (
              <Text color={colors.textDim} dimColor>
                {" "}
                ›{" "}
              </Text>
            )}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
});

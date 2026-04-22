import React from "react";
import { Text } from "ink";
import { runloopBaseDomain } from "../utils/config.js";
import { colors } from "../utils/theme.js";

/** Shows the active domain in the home footer when it differs from the default. */
export function HomeBaseUrlText() {
  const baseDomain = React.useMemo(() => runloopBaseDomain(), []);
  if (baseDomain === "runloop.ai") return null;
  return (
    <Text color={colors.textDim} dimColor>
      {"\n"}
      Domain: {baseDomain}
    </Text>
  );
}

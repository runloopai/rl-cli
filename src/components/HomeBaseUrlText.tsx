import React from "react";
import { Text } from "ink";
import { baseUrl } from "../utils/config.js";
import { colors } from "../utils/theme.js";

/** Compact API origin (`https://api.<RUNLOOP_BASE_URL>` when set) for home footer. */
export function HomeBaseUrlText() {
  const apiBase = React.useMemo(() => baseUrl(), []);
  return (
    <Text color={colors.textDim} dimColor>
      {"\n"}
      Base URL: {apiBase}
    </Text>
  );
}

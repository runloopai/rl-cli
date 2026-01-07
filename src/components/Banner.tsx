import React from "react";
import { Box } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import { isLightMode } from "../utils/theme.js";

export const Banner = React.memo(() => {
  // Use theme-aware gradient colors
  // In light mode, use darker/deeper colors for better contrast on light backgrounds
  // "teen" has darker colors (blue/purple) that work well on light backgrounds
  // In dark mode, use the vibrant "vice" gradient (pink/cyan) that works well on dark backgrounds
  const gradientName = isLightMode() ? "teen" : "vice";

  return (
    <Box flexDirection="column" alignItems="flex-start" paddingX={1}>
      <Gradient name={gradientName}>
        <BigText text="RUNLOOP.ai" font="simple3d" />
      </Gradient>
    </Box>
  );
});

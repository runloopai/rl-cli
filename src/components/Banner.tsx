import React from "react";
import { Box } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";

export const Banner: React.FC = React.memo(() => {
  return (
    <Box flexDirection="column" alignItems="flex-start">
      <Gradient name="vice">
        <BigText text="RUNLOOP.ai" font="simple3d" />
      </Gradient>
    </Box>
  );
});

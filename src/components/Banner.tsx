import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import { isLightMode } from "../utils/theme.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";

// Dramatic shades of green shimmer - wide range
const DARK_SHIMMER_COLORS = [
  "#024A38", // Very very dark emerald
  "#035544", //
  "#036050", //
  "#046C54", //
  "#04765C", //
  "#058164", //
  "#058C6D", //
  "#059669", // Deep emerald
  "#08A076", //
  "#0BA67B", //
  "#0EAE84", //
  "#10B981", // Runloop success green
  "#14C793", // Lighter emerald
  "#1CD7A7", //
  "#24E0B5", //
  "#30EAC0", //
  "#40F5CC", // Very bright emerald
  "#30EAC0", //
  "#24E0B5", //
  "#1CD7A7", //
  "#14C793", // Lighter emerald
  "#10B981", // Runloop success green
  "#0EAE84", //
  "#0BA67B", //
  "#08A076", //
  "#059669", // Deep emerald
  "#058C6D", //
  "#058164", //
  "#04765C", //
  "#046C54", //
  "#036050", //
  "#035544", //
];

const LIGHT_SHIMMER_COLORS = [
  "#034D3A", // Very very deep emerald
  "#045540", //
  "#055D46", //
  "#065F46", //
  "#046A50", //
  "#047857", // Deep emerald
  "#058360", //
  "#058C68", //
  "#059669", // Runloop light success green
  "#08A076", //
  "#0BA67B", //
  "#0EAE84", //
  "#10B981", // Medium emerald
  "#14C793", // Lighter emerald
  "#18D29F", //
  "#1CDCA9", //
  "#20E5B3", //
  "#1CDCA9", //
  "#18D29F", //
  "#14C793", // Lighter emerald
  "#10B981", // Medium emerald
  "#0EAE84", //
  "#0BA67B", //
  "#08A076", //
  "#059669", // Runloop light success green
  "#058C68", //
  "#058360", //
  "#047857", // Deep emerald
  "#046A50", //
  "#065F46", //
  "#055D46", //
  "#045540", //
];

// Pre-compute all rotated color frames at module load time
const precomputeFrames = (colors: string[]): string[][] => {
  return colors.map((_, i) => [...colors.slice(i), ...colors.slice(0, i)]);
};

const DARK_FRAMES = precomputeFrames(DARK_SHIMMER_COLORS);
const LIGHT_FRAMES = precomputeFrames(LIGHT_SHIMMER_COLORS);

// Minimum width to show the full BigText banner (simple3d font needs ~80 chars for "RUNLOOP.ai")
const MIN_WIDTH_FOR_BIG_BANNER = 90;

// Animation interval in ms
const SHIMMER_INTERVAL = 150;

export const Banner = React.memo(() => {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = isLightMode() ? LIGHT_FRAMES : DARK_FRAMES;
  const { terminalWidth } = useViewportHeight();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if we should show compact mode
  const isCompact = terminalWidth < MIN_WIDTH_FOR_BIG_BANNER;

  useEffect(() => {
    const tick = () => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
      timeoutRef.current = setTimeout(tick, SHIMMER_INTERVAL);
    };

    timeoutRef.current = setTimeout(tick, SHIMMER_INTERVAL);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [frames.length]);

  // Use pre-computed frame - no array operations during render
  const currentColors = frames[frameIndex];

  // Compact banner for narrow terminals
  if (isCompact) {
    return (
      <Box flexDirection="column" alignItems="flex-start" paddingX={1}>
        <Gradient colors={currentColors}>
          <Text bold>◆ RUNLOOP.ai</Text>
        </Gradient>
      </Box>
    );
  }

  // Full banner for wide terminals
  return (
    <Box flexDirection="column" alignItems="flex-start" paddingX={1}>
      <Gradient colors={currentColors}>
        <BigText text="RUNLOOP.ai" font="simple3d" />
      </Gradient>
    </Box>
  );
});

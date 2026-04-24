import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useStdout } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import { isLightMode } from "../utils/theme.js";
import { runloopBannerText } from "../utils/config.js";

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

// Use every 2nd color to reduce frame count and minimize flickering
const DARK_FRAMES = precomputeFrames(
  DARK_SHIMMER_COLORS.filter((_, i) => i % 2 === 0),
);
const LIGHT_FRAMES = precomputeFrames(
  LIGHT_SHIMMER_COLORS.filter((_, i) => i % 2 === 0),
);

// Minimum height to show the full BigText banner - require generous room
const MIN_HEIGHT_FOR_BIG_BANNER = 43;
// Cap: don't attempt BigText for domains wider than this (they wrap to multiple rows)
const MAX_BIG_BANNER_WIDTH = 92;

// Animation interval in ms
const SHIMMER_INTERVAL = 400;

export const Banner = React.memo(() => {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = isLightMode() ? LIGHT_FRAMES : DARK_FRAMES;
  const { stdout } = useStdout();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive banner text from RUNLOOP_BASE_URL when set
  const bannerText = React.useMemo(() => runloopBannerText(), []);
  // simple3d font averages ~8 columns per character + padding
  const estimatedBigTextWidth = bannerText.length * 8 + 12;

  // Get raw terminal dimensions, responding to resize events
  // Default to conservative values if we can't detect (triggers compact mode)
  const getDimensions = React.useCallback(
    () => ({
      width: stdout?.columns && stdout.columns > 0 ? stdout.columns : 80,
      height: stdout?.rows && stdout.rows > 0 ? stdout.rows : 20,
    }),
    [stdout],
  );

  const [dimensions, setDimensions] = useState(getDimensions);

  useEffect(() => {
    // Update immediately on mount and when stdout changes
    setDimensions(getDimensions());

    if (!stdout) return;

    const handleResize = () => {
      setDimensions(getDimensions());
    };

    stdout.on("resize", handleResize);

    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout, getDimensions]);

  // Determine if we should show compact mode (text too long, not enough width, or height)
  const isCompact =
    estimatedBigTextWidth > MAX_BIG_BANNER_WIDTH ||
    dimensions.width < estimatedBigTextWidth ||
    dimensions.height < MIN_HEIGHT_FOR_BIG_BANNER;

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
          <Text bold>◆ {bannerText}</Text>
        </Gradient>
      </Box>
    );
  }

  // Full banner for wide terminals
  return (
    <Box flexDirection="column" alignItems="flex-start" paddingX={1}>
      <Gradient colors={currentColors}>
        <BigText text={bannerText} font="simple3d" />
      </Gradient>
    </Box>
  );
});

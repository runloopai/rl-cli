import React, { useState, useEffect } from "react";
import { Box } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import { isLightMode } from "../utils/theme.js";

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

export const Banner = React.memo(() => {
  const [offset, setOffset] = useState(0);
  const colors = isLightMode() ? LIGHT_SHIMMER_COLORS : DARK_SHIMMER_COLORS;

  useEffect(() => {
    const interval = setInterval(() => {
      setOffset((prev) => (prev - 1 + colors.length) % colors.length);
    }, 250); // Slower, more subtle shimmer

    return () => clearInterval(interval);
  }, [colors.length]);

  // Create a subtle shimmer by shifting the color array
  const rotatedColors = [
    ...colors.slice(offset),
    ...colors.slice(0, offset),
  ];

  return (
    <Box flexDirection="column" alignItems="flex-start" paddingX={1}>
      <Gradient colors={rotatedColors}>
        <BigText text="RUNLOOP.ai" font="simple3d" />
      </Gradient>
    </Box>
  );
});

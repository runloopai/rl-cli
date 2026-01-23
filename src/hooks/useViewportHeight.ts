import React from "react";
import { useStdout } from "ink";

interface UseViewportHeightOptions {
  /** Number of lines reserved for headers, footers, and chrome elements */
  overhead?: number;
  /** Minimum viewport height to ensure usability */
  minHeight?: number;
  /** Maximum viewport height to prevent excessive content */
  maxHeight?: number;
}

interface ViewportDimensions {
  /** Available height for content (terminal height minus overhead) */
  viewportHeight: number;
  /** Total terminal height in lines */
  terminalHeight: number;
  /** Total terminal width in columns */
  terminalWidth: number;
}

/**
 * Get safe terminal dimensions with bounds checking
 */
function getSafeDimensions(
  stdout: { columns?: number; rows?: number } | undefined,
): {
  width: number;
  height: number;
} {
  const sampledWidth =
    stdout?.columns && stdout.columns > 0 ? stdout.columns : 120;
  const sampledHeight = stdout?.rows && stdout.rows > 0 ? stdout.rows : 30;

  return {
    width: Math.max(80, Math.min(300, sampledWidth)),
    height: Math.max(20, Math.min(100, sampledHeight)),
  };
}

/**
 * Custom hook to calculate available viewport height for content rendering.
 * Ensures consistent layout calculations across all CLI screens and prevents overflow.
 * Responds to terminal resize events to update layout dynamically.
 *
 * @param options Configuration for viewport calculation
 * @returns Viewport dimensions including available height for content
 *
 * @example
 * ```tsx
 * const { viewportHeight } = useViewportHeight({ overhead: 10 });
 * const pageSize = viewportHeight; // Use for dynamic page sizing
 * ```
 */
export function useViewportHeight(
  options: UseViewportHeightOptions = {},
): ViewportDimensions {
  const { overhead = 0, minHeight = 5, maxHeight = 100 } = options;
  const { stdout } = useStdout();

  // Use state to track dimensions so we can respond to resize events
  const [dimensions, setDimensions] = React.useState(() =>
    getSafeDimensions(stdout),
  );

  // Listen for terminal resize events
  React.useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      const newDimensions = getSafeDimensions(stdout);
      setDimensions((prev) => {
        // Only update if dimensions actually changed
        if (
          prev.width !== newDimensions.width ||
          prev.height !== newDimensions.height
        ) {
          return newDimensions;
        }
        return prev;
      });
    };

    // Listen for resize events
    stdout.on("resize", handleResize);

    // Also check dimensions on mount in case they differ from initial
    handleResize();

    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout]);

  const terminalHeight = dimensions.height;
  const terminalWidth = dimensions.width;

  // Calculate viewport height with bounds
  const viewportHeight = Math.max(
    minHeight,
    Math.min(maxHeight, terminalHeight - overhead),
  );

  return {
    viewportHeight,
    terminalHeight,
    terminalWidth,
  };
}

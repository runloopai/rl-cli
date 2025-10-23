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
 * Custom hook to calculate available viewport height for content rendering.
 * Ensures consistent layout calculations across all CLI screens and prevents overflow.
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

  // Memoize terminal dimensions to prevent unnecessary re-renders
  const terminalHeight = React.useMemo(
    () => stdout?.rows || 30,
    [stdout?.rows],
  );

  const terminalWidth = React.useMemo(
    () => stdout?.columns || 120,
    [stdout?.columns],
  );

  // Calculate viewport height with bounds
  const viewportHeight = React.useMemo(() => {
    const available = terminalHeight - overhead;
    return Math.max(minHeight, Math.min(maxHeight, available));
  }, [terminalHeight, overhead, minHeight, maxHeight]);

  return {
    viewportHeight,
    terminalHeight,
    terminalWidth,
  };
}

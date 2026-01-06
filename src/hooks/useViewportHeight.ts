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

  // Sample terminal dimensions ONCE and use fixed values - no reactive dependencies
  // This prevents re-renders and Yoga WASM crashes from dynamic resizing
  // CRITICAL: Initialize with safe fallback values to prevent null/undefined
  const dimensions = React.useRef<{ width: number; height: number }>({
    width: 120,
    height: 30,
  });

  // Only sample on first call when still at default values
  if (dimensions.current.width === 120 && dimensions.current.height === 30) {
    // Only sample if stdout has valid dimensions
    const sampledWidth =
      stdout?.columns && stdout.columns > 0 ? stdout.columns : 120;
    const sampledHeight = stdout?.rows && stdout.rows > 0 ? stdout.rows : 30;

    // Always enforce safe bounds to prevent Yoga crashes
    dimensions.current = {
      width: Math.max(80, Math.min(200, sampledWidth)),
      height: Math.max(20, Math.min(100, sampledHeight)),
    };
  }

  const terminalHeight = dimensions.current.height;
  const terminalWidth = dimensions.current.width;

  // Calculate viewport height with bounds
  const viewportHeight = Math.max(
    minHeight,
    Math.min(maxHeight, terminalHeight - overhead),
  );
  // Removed console.logs to prevent rendering interference

  return {
    viewportHeight,
    terminalHeight,
    terminalWidth,
  };
}

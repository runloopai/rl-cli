/**
 * Color theme constants for the CLI application
 * Centralized color definitions for easy theme customization
 */

import { detectTerminalTheme, type ThemeMode } from "./terminalDetection.js";
import {
  getThemePreference,
  getDetectedTheme,
  setDetectedTheme,
} from "./config.js";
import chalk from "chalk";

// Color palette structure
type ColorPalette = {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  text: string;
  textDim: string;
  border: string;
  background: string;
  accent1: string;
  accent2: string;
  accent3: string;
  idColor: string;
};

// Dark mode color palette (default)
const darkColors: ColorPalette = {
  // Primary brand colors
  primary: "#00D9FF", // Bright cyan
  secondary: "#FF6EC7", // Vibrant magenta

  // Status colors
  success: "#10B981", // Emerald green
  warning: "#F59E0B", // Amber
  error: "#EF4444", // Red
  info: "#3B82F6", // Blue

  // UI colors
  text: "#FFFFFF", // White
  textDim: "#9CA3AF", // Gray
  border: "#6B7280", // Medium gray
  background: "#000000", // Black

  // Accent colors for menu items and highlights
  accent1: "#00D9FF", // Same as primary
  accent2: "#FF6EC7", // Same as secondary
  accent3: "#10B981", // Same as success

  // ID color for displaying resource IDs
  idColor: "#60A5FA", // Muted blue for IDs
};

// Light mode color palette
const lightColors: ColorPalette = {
  // Primary brand colors (brighter/darker for visibility on light backgrounds)
  primary: "#2563EB", // Deep blue
  secondary: "#C026D3", // Deep magenta

  // Status colors
  success: "#059669", // Deep green
  warning: "#D97706", // Deep amber
  error: "#DC2626", // Deep red
  info: "#2563EB", // Deep blue

  // UI colors
  text: "#000000", // Black
  textDim: "#4B5563", // Dark gray for better contrast on light backgrounds
  border: "#9CA3AF", // Medium gray
  background: "#FFFFFF", // White

  // Accent colors for menu items and highlights
  accent1: "#2563EB", // Same as primary
  accent2: "#C026D3", // Same as secondary
  accent3: "#059669", // Same as success

  // ID color for displaying resource IDs
  idColor: "#0284C7", // Deeper blue for IDs on light backgrounds
};

// Current active color palette (initialized by initializeTheme)
let activeColors: ColorPalette = darkColors;
let currentTheme: ThemeMode = "dark";

/**
 * Get the current color palette
 * This is the main export that components should use
 */
export const colors = new Proxy({} as ColorPalette, {
  get(_target, prop: string) {
    return activeColors[prop as keyof ColorPalette];
  },
});

/**
 * Initialize the theme system
 * Must be called at CLI startup before rendering any UI
 */
export async function initializeTheme(): Promise<void> {
  const preference = getThemePreference();

  let detectedTheme: ThemeMode | null = null;

  // Auto-detect if preference is 'auto'
  // Always detect on startup to support different terminal profiles
  // (users may have different terminal profiles with different themes)
  if (preference === "auto") {
    try {
      detectedTheme = await detectTerminalTheme();
      // Cache the result for reference, but we always re-detect on startup
      if (detectedTheme) {
        setDetectedTheme(detectedTheme);
      }
    } catch {
      // Detection failed, fall back to cached value or dark mode
      const cachedTheme = getDetectedTheme();
      detectedTheme = cachedTheme || null;
    }
  }

  // Determine final theme
  if (preference === "light") {
    currentTheme = "light";
    activeColors = lightColors;
  } else if (preference === "dark") {
    currentTheme = "dark";
    activeColors = darkColors;
  } else if (detectedTheme) {
    // Auto mode with successful detection
    currentTheme = detectedTheme;
    activeColors = detectedTheme === "light" ? lightColors : darkColors;
  } else {
    // Auto mode with failed detection - default to dark
    currentTheme = "dark";
    activeColors = darkColors;
  }
}

/**
 * Get the current theme mode
 */
export function getCurrentTheme(): ThemeMode {
  return currentTheme;
}

export type ColorName = keyof ColorPalette;
export type ColorValue = ColorPalette[ColorName];

/**
 * Get hex color value for a color name
 * Useful for applying colors dynamically
 */
export function getChalkColor(colorName: ColorName): string {
  return activeColors[colorName];
}

/**
 * Get chalk text color function for a color name
 * Converts hex color to chalk function for text coloring
 * @param colorName - Name of the color from the palette
 * @returns Chalk function that can be used to color text
 */
export function getChalkTextColor(colorName: ColorName) {
  const hexColor = activeColors[colorName];
  return chalk.hex(hexColor);
}

/**
 * Get chalk background color function for a color name
 * Converts hex color to chalk function for background coloring
 * @param colorName - Name of the color from the palette
 * @returns Chalk function that can be used to color backgrounds
 */
export function getChalkBgColor(colorName: ColorName) {
  const hexColor = activeColors[colorName];
  return chalk.bgHex(hexColor);
}

/**
 * Check if we should use inverted colors (light mode)
 * Useful for components that need to explicitly set backgrounds
 */
export function isLightMode(): boolean {
  return currentTheme === "light";
}

/**
 * Force set theme mode directly without detection
 * Used for live preview in theme selector
 */
export function setThemeMode(mode: ThemeMode): void {
  currentTheme = mode;
  activeColors = mode === "light" ? lightColors : darkColors;
}

/**
 * Sanitize width values to prevent Yoga WASM crashes
 * Ensures width is a valid, finite number within safe bounds
 *
 * @param width - The width value to sanitize
 * @param min - Minimum allowed width (default: 1)
 * @param max - Maximum allowed width (default: 100)
 * @returns A safe width value guaranteed to be within [min, max]
 */
export function sanitizeWidth(width: number, min = 1, max = 100): number {
  // Check for NaN, Infinity, or other invalid numbers
  if (!Number.isFinite(width) || width < min) {
    return min;
  }
  return Math.min(width, max);
}

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
};

// Dark mode color palette (default)
const darkColors: ColorPalette = {
  // Primary brand colors
  primary: "cyan",
  secondary: "magenta",

  // Status colors
  success: "green",
  warning: "yellow",
  error: "red",
  info: "blue",

  // UI colors
  text: "white",
  textDim: "gray",
  border: "gray",
  background: "black",

  // Accent colors for menu items and highlights
  accent1: "cyan",
  accent2: "magenta",
  accent3: "green",
};

// Light mode color palette
const lightColors: ColorPalette = {
  // Primary brand colors (brighter/darker for visibility on light backgrounds)
  primary: "blue",
  secondary: "magenta",

  // Status colors
  success: "green",
  warning: "yellow",
  error: "red",
  info: "blue",

  // UI colors
  text: "black",
  textDim: "blackBright", // Darker gray for better contrast on light backgrounds
  border: "blackBright",
  background: "white",

  // Accent colors for menu items and highlights
  accent1: "blue",
  accent2: "magenta",
  accent3: "green",
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
  if (preference === "auto") {
    // Check cache first - only detect if we haven't cached a result
    const cachedTheme = getDetectedTheme();
    
    if (cachedTheme) {
      // Use cached detection result (no flashing!)
      detectedTheme = cachedTheme;
    } else {
      // First time detection - run it and cache the result
      try {
        detectedTheme = await detectTerminalTheme();
        if (detectedTheme) {
          // Cache the result so we don't detect again
          setDetectedTheme(detectedTheme);
        }
      } catch (error) {
        // Detection failed, fall back to dark mode
        detectedTheme = null;
      }
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
 * Get chalk function for a color name
 * Useful for applying colors dynamically
 */
export function getChalkColor(colorName: ColorName): string {
  return activeColors[colorName];
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

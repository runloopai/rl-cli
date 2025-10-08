/**
 * Color theme constants for the CLI application
 * Centralized color definitions for easy theme customization
 */

export const colors = {
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

  // Accent colors for menu items and highlights
  accent1: "cyan",
  accent2: "magenta",
  accent3: "green",
} as const;

export type ColorName = keyof typeof colors;
export type ColorValue = (typeof colors)[ColorName];

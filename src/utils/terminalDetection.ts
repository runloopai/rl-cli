/**
 * Terminal background color detection utility
 * Uses ANSI escape sequences to query the terminal's background color
 */

import { stdin, stdout } from "process";

export type ThemeMode = "light" | "dark";

/**
 * Calculate luminance from RGB values to determine if background is light or dark
 * Using relative luminance formula: https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const normalized = c / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Parse RGB color from terminal response
 * Expected format: rgb:RRRR/GGGG/BBBB or similar variations
 */
function parseRGBResponse(response: string): {
  r: number;
  g: number;
  b: number;
} | null {
  // Match patterns like: rgb:RRRR/GGGG/BBBB or rgba:RRRR/GGGG/BBBB/AAAA
  const rgbMatch = response.match(/rgba?:([0-9a-f]+)\/([0-9a-f]+)\/([0-9a-f]+)/i);
  if (!rgbMatch) {
    return null;
  }

  // Parse hex values and normalize to 0-255 range
  const r = parseInt(rgbMatch[1].substring(0, 2), 16);
  const g = parseInt(rgbMatch[2].substring(0, 2), 16);
  const b = parseInt(rgbMatch[3].substring(0, 2), 16);

  return { r, g, b };
}

/**
 * Detect terminal theme by querying background color
 * Returns 'light' or 'dark' based on background luminance, or null if detection fails
 */
export async function detectTerminalTheme(): Promise<ThemeMode | null> {
  // Skip detection in non-TTY environments
  if (!stdin.isTTY || !stdout.isTTY) {
    return null;
  }

  // Allow users to disable detection if it causes flashing
  if (process.env.RUNLOOP_DISABLE_THEME_DETECTION === "1") {
    return null;
  }

  return new Promise((resolve) => {
    let response = "";
    let timeout: NodeJS.Timeout;

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      clearTimeout(timeout);
    };

    const onData = (chunk: Buffer) => {
      response += chunk.toString();

      // Check if we have a complete response (ends with ESC \ or BEL)
      if (response.includes("\x1b\\") || response.includes("\x07")) {
        cleanup();

        const rgb = parseRGBResponse(response);
        if (rgb) {
          const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
          // Threshold: luminance > 0.5 is considered light background
          resolve(luminance > 0.5 ? "light" : "dark");
        } else {
          resolve(null);
        }
      }
    };

    // Set timeout for terminals that don't support the query
    timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 50); // 50ms timeout - quick to minimize any visual flashing

    try {
      // Enable raw mode to capture escape sequences
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on("data", onData);

      // Query background color using OSC 11 sequence
      // Format: ESC ] 11 ; ? ESC \
      stdout.write("\x1b]11;?\x1b\\");
    } catch (error) {
      cleanup();
      resolve(null);
    }
  });
}


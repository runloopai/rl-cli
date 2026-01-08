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
 * Terminal responses can come in various formats:
 * - OSC 11;rgb:RRRR/GGGG/BBBB (xterm-style, 4 hex digits per channel)
 * - OSC 11;rgb:RR/GG/BB (short format, 2 hex digits per channel)
 * - rgb:RRRR/GGGG/BBBB (without OSC prefix)
 */
function parseRGBResponse(response: string): {
  r: number;
  g: number;
  b: number;
} | null {
  // Try multiple patterns to handle different terminal response formats

  // Pattern 1: OSC 11;rgb:RRRR/GGGG/BBBB or 11;rgb:RRRR/GGGG/BBBB (xterm-style, 4 hex digits)
  let match = response.match(
    /11;rgb:([0-9a-f]{4})\/([0-9a-f]{4})\/([0-9a-f]{4})/i,
  );
  if (match) {
    // Take first 2 hex digits and convert to 0-255
    const r = parseInt(match[1].substring(0, 2), 16);
    const g = parseInt(match[2].substring(0, 2), 16);
    const b = parseInt(match[3].substring(0, 2), 16);
    return { r, g, b };
  }

  // Pattern 2: OSC 11;rgb:RR/GG/BB (short format, 2 hex digits)
  match = response.match(/11;rgb:([0-9a-f]{2})\/([0-9a-f]{2})\/([0-9a-f]{2})/i);
  if (match) {
    const r = parseInt(match[1], 16);
    const g = parseInt(match[2], 16);
    const b = parseInt(match[3], 16);
    return { r, g, b };
  }

  // Pattern 3: rgb:RRRR/GGGG/BBBB (without OSC prefix, 4 hex digits)
  match = response.match(/rgb:([0-9a-f]{4})\/([0-9a-f]{4})\/([0-9a-f]{4})/i);
  if (match) {
    const r = parseInt(match[1].substring(0, 2), 16);
    const g = parseInt(match[2].substring(0, 2), 16);
    const b = parseInt(match[3].substring(0, 2), 16);
    return { r, g, b };
  }

  // Pattern 4: rgb:RR/GG/BB (without OSC prefix, 2 hex digits)
  match = response.match(/rgb:([0-9a-f]{2})\/([0-9a-f]{2})\/([0-9a-f]{2})/i);
  if (match) {
    const r = parseInt(match[1], 16);
    const g = parseInt(match[2], 16);
    const b = parseInt(match[3], 16);
    return { r, g, b };
  }

  // Pattern 5: Generic pattern for any hex values separated by /
  match = response.match(/([0-9a-f]{2,4})\/([0-9a-f]{2,4})\/([0-9a-f]{2,4})/i);
  if (match) {
    const r = parseInt(match[1].substring(0, 2), 16);
    const g = parseInt(match[2].substring(0, 2), 16);
    const b = parseInt(match[3].substring(0, 2), 16);
    return { r, g, b };
  }

  return null;
}

/**
 * Detect terminal theme by querying background color
 * Returns 'light' or 'dark' based on background luminance, or null if detection fails
 *
 * NOTE: Theme detection runs automatically when theme preference is "auto".
 * Users can disable it by setting RUNLOOP_DISABLE_THEME_DETECTION=1 to prevent
 * any potential terminal flashing.
 */
export async function detectTerminalTheme(): Promise<ThemeMode | null> {
  // Skip detection in non-TTY environments
  if (!stdin.isTTY || !stdout.isTTY) {
    return null;
  }

  // Allow users to opt-out of theme detection if they experience flashing
  if (process.env.RUNLOOP_DISABLE_THEME_DETECTION === "1") {
    return null;
  }

  return new Promise((resolve) => {
    let response = "";
    let timeout: ReturnType<typeof setTimeout>;
    let hasResolved = false;

    const cleanup = () => {
      try {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdin.removeListener("readable", onReadable);
      } catch {
        // Ignore errors during cleanup
      }
      if (timeout) {
        clearTimeout(timeout);
      }
    };

    const finish = (result: ThemeMode | null) => {
      if (hasResolved) return;
      hasResolved = true;
      cleanup();
      resolve(result);
    };

    const onData = (chunk: Buffer) => {
      if (hasResolved) return;

      const text = chunk.toString("utf8");
      response += text;

      // Check if we have a complete response
      // Terminal responses typically end with ESC \ (ST) or BEL (\x07)
      // Some terminals may also send the response without the OSC prefix
      if (
        response.includes("\x1b\\") ||
        response.includes("\x07") ||
        response.includes("\x1b]")
      ) {
        const rgb = parseRGBResponse(response);
        if (rgb) {
          const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
          // Threshold: luminance > 0.5 is considered light background
          finish(luminance > 0.5 ? "light" : "dark");
          return;
        }
        // If we got a response but couldn't parse it, check if it's complete
        if (response.includes("\x1b\\") || response.includes("\x07")) {
          finish(null);
          return;
        }
      }
    };

    // Some terminals may send responses through the readable event instead
    const onReadable = () => {
      if (hasResolved) return;

      let chunk: Buffer | null;
      while ((chunk = stdin.read()) !== null) {
        const text = chunk.toString("utf8");
        response += text;

        if (text.includes("\x1b\\") || text.includes("\x07")) {
          const rgb = parseRGBResponse(response);
          if (rgb) {
            const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
            finish(luminance > 0.5 ? "light" : "dark");
            return;
          }
          finish(null);
          return;
        }
      }
    };

    // Set timeout for terminals that don't support the query
    timeout = setTimeout(() => {
      finish(null);
    }, 200); // Increased timeout to 200ms to give terminals more time to respond

    try {
      // Enable raw mode to capture escape sequences
      stdin.setRawMode(true);
      stdin.resume();

      // Listen to both data and readable events
      stdin.on("data", onData);
      stdin.on("readable", onReadable);

      // Query background color using OSC 11 sequence
      // Format: ESC ] 11 ; ? ESC \
      // Some terminals may need the BEL terminator instead
      stdout.write("\x1b]11;?\x1b\\");

      // Also try with BEL terminator as some terminals prefer it
      // (but wait a bit to see if first one works)
      setTimeout(() => {
        if (!hasResolved) {
          stdout.write("\x1b]11;?\x07");
        }
      }, 10);
    } catch {
      finish(null);
    }
  });
}

/**
 * Terminal synchronous update mode utilities
 * 
 * Uses ANSI escape sequences to prevent screen flicker by batching terminal updates.
 * This tells the terminal to buffer all output between BEGIN and END markers
 * and only display it atomically, preventing the visible flashing during redraws.
 * 
 * Supported by most modern terminals (iTerm2, Terminal.app, Alacritty, etc.)
 * When not supported, these sequences are simply ignored.
 */

// Begin Synchronous Update (BSU) - tells terminal to start buffering
export const BEGIN_SYNC = "\x1b[?2026h";

// End Synchronous Update (ESU) - tells terminal to flush buffer atomically
export const END_SYNC = "\x1b[?2026l";

/**
 * Enable synchronous updates for the terminal
 * Call this once at application startup
 */
export function enableSynchronousUpdates(): void {
  process.stdout.write(BEGIN_SYNC);
}

/**
 * Disable synchronous updates for the terminal
 * Call this at application shutdown
 */
export function disableSynchronousUpdates(): void {
  process.stdout.write(END_SYNC);
}

/**
 * Wrap terminal output with synchronous update markers
 * This ensures the output is displayed atomically without flicker
 */
export function withSynchronousUpdate(fn: () => void): void {
  process.stdout.write(BEGIN_SYNC);
  fn();
  process.stdout.write(END_SYNC);
}





/**
 * Terminal screen buffer utilities.
 *
 * The alternate screen buffer provides a fullscreen experience similar to
 * applications like vim, top, or htop. When enabled, the terminal saves
 * the current screen content and switches to a clean buffer. Upon exit,
 * the original screen content is restored.
 */

/**
 * Enter the alternate screen buffer.
 * This provides a fullscreen experience where content won't mix with
 * previous terminal output. Like vim or top.
 */
export function enterAlternateScreenBuffer(): void {
  process.stdout.write("\x1b[?1049h");
}

/**
 * Exit the alternate screen buffer and restore the previous screen content.
 * This returns the terminal to its original state before enterAlternateScreen() was called.
 */
export function exitAlternateScreenBuffer(): void {
  process.stdout.write("\x1b[?1049l");
}

/**
 * Clear the terminal screen.
 * Uses ANSI escape sequences to clear the screen and move cursor to top-left.
 */
export function clearScreen(): void {
  // Clear entire screen and move cursor to top-left
  process.stdout.write("\x1b[2J\x1b[H");
}

/**
 * Show the terminal cursor.
 * Uses ANSI escape sequence to make the cursor visible.
 */
export function showCursor(): void {
  process.stdout.write("\x1b[?25h");
}

/**
 * Hide the terminal cursor.
 * Uses ANSI escape sequence to make the cursor invisible.
 */
export function hideCursor(): void {
  process.stdout.write("\x1b[?25l");
}

/**
 * Reset terminal to a clean state.
 * Exits alternate screen buffer, clears the screen, and resets cursor.
 * Also resets terminal attributes to ensure clean state for subprocesses.
 */
export function resetTerminal(): void {
  exitAlternateScreenBuffer();
  clearScreen();
  // Reset terminal attributes (SGR reset)
  process.stdout.write("\x1b[0m");
  // Move cursor to home position
  process.stdout.write("\x1b[H");
  // Show cursor to ensure it's visible
  showCursor();
}

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

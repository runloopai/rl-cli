/**
 * Wrapper for interactive commands that need alternate screen buffer management
 */
export async function runInteractiveCommand(command: () => Promise<void>) {
  // Enter alternate screen buffer
  process.stdout.write('\x1b[?1049h');

  try {
    await command();
  } finally {
    // Exit alternate screen buffer
    process.stdout.write('\x1b[?1049l');
  }
}

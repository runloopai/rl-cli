/**
 * Cross-platform browser-opening utility.
 */

/**
 * Open a URL in the system's default browser.
 * Works on macOS (open), Windows (start), and Linux (xdg-open).
 */
export async function openInBrowser(url: string): Promise<void> {
  const { exec } = await import("child_process");
  const platform = process.platform;

  let openCommand: string;
  if (platform === "darwin") {
    openCommand = `open "${url}"`;
  } else if (platform === "win32") {
    openCommand = `start "${url}"`;
  } else {
    openCommand = `xdg-open "${url}"`;
  }

  exec(openCommand);
}

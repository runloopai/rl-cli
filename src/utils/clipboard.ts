/**
 * Cross-platform clipboard utility.
 */

/**
 * Copy text to the system clipboard.
 * Returns a promise that resolves with a status message.
 */
export async function copyToClipboard(text: string): Promise<string> {
  const { spawn } = await import("child_process");
  const platform = process.platform;

  let command: string;
  let args: string[];

  if (platform === "darwin") {
    command = "pbcopy";
    args = [];
  } else if (platform === "win32") {
    command = "clip";
    args = [];
  } else {
    command = "xclip";
    args = ["-selection", "clipboard"];
  }

  return new Promise((resolve) => {
    const proc = spawn(command, args);
    proc.stdin.write(text);
    proc.stdin.end();

    proc.on("exit", (code) => {
      if (code === 0) {
        resolve("Copied ID to clipboard!");
      } else {
        resolve("Failed to copy");
      }
    });

    proc.on("error", () => {
      resolve("Copy not supported");
    });
  });
}

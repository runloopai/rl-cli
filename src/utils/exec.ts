import { spawnSync } from "child_process";
import { showCursor } from "./screen.js";
import { processUtils } from "./processUtils.js";

/**
 * Release terminal from Ink and exec into a new command (one-way, no return)
 * This function never returns - it runs the command synchronously and exits.
 */
export function execCommand(command: string, args: string[]): never {
  // Release terminal from Ink's control
  process.stdin.pause();
  if (processUtils.stdin.isTTY && processUtils.stdin.setRawMode) {
    processUtils.stdin.setRawMode(false);
  }
  if (processUtils.stdout.isTTY) {
    processUtils.stdout.write("\x1b[0m"); // SGR reset
  }
  showCursor();

  // Run the command synchronously - this blocks until complete
  const result = spawnSync(command, args, { stdio: "inherit" });

  // Exit with the command's exit code
  process.exit(result.status ?? 0);
}

import { getClient } from "./client.js";
import { cliStatus } from "./cliStatus.js";

export interface WaitForReadyOptions {
  /** If true, omit periodic poll lines (e.g. when stdout must stay machine-clean). */
  quiet?: boolean;
}

/**
 * Wait for a devbox to be ready
 */
export async function waitForReady(
  devboxId: string,
  timeoutSeconds: number = 180,
  pollIntervalSeconds: number = 3,
  waitOptions?: WaitForReadyOptions,
): Promise<boolean> {
  const quiet = waitOptions?.quiet ?? false;
  const startTime = Date.now();
  const client = getClient();

  while (true) {
    try {
      const devbox = await client.devboxes.retrieve(devboxId);
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = timeoutSeconds - elapsed;

      if (devbox.status === "running") {
        return true;
      } else if (devbox.status === "failure") {
        cliStatus(
          `Devbox ${devboxId} failed to start (status: ${devbox.status})`,
        );
        return false;
      } else if (["shutdown", "suspended"].includes(devbox.status)) {
        cliStatus(
          `Devbox ${devboxId} is not running (status: ${devbox.status})`,
        );
        return false;
      } else {
        if (!quiet) {
          cliStatus(
            `Devbox ${devboxId} is still ${devbox.status}... (elapsed: ${elapsed.toFixed(0)}s, remaining: ${remaining.toFixed(0)}s)`,
          );
        }

        if (elapsed >= timeoutSeconds) {
          cliStatus(
            `Timeout waiting for devbox ${devboxId} to be ready after ${timeoutSeconds} seconds`,
          );
          return false;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, pollIntervalSeconds * 1000),
        );
      }
    } catch (error) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= timeoutSeconds) {
        cliStatus(
          `Timeout waiting for devbox ${devboxId} to be ready after ${timeoutSeconds} seconds (error: ${error})`,
        );
        return false;
      }

      if (!quiet) {
        cliStatus(
          `Error checking devbox status: ${error}, retrying in ${pollIntervalSeconds} seconds...`,
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, pollIntervalSeconds * 1000),
      );
    }
  }
}

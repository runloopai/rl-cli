import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir, chmod, access } from "fs/promises";
import { constants } from "fs";
import { join } from "path";
import { homedir } from "os";
import { getClient } from "./client.js";

const execAsync = promisify(exec);

export interface SSHKeyInfo {
  keyfilePath: string;
  privateKey: string;
  url: string;
}

export function constructSSHConfig(options: {
  hostname: string;
  username: string;
  keyPath: string;
  port: number;
}): string {
  return `Host ${options.hostname}
  User ${options.username}
  Hostname ${options.hostname}
  Port ${options.port}
  IdentityFile ${options.keyPath}
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
  ProxyCommand openssl s_client -connect ${options.hostname}:${options.port} -quiet
`;
}

export interface SSHOptions {
  devboxId: string;
  configOnly?: boolean;
  noWait?: boolean;
  timeout?: number;
  pollInterval?: number;
}

/**
 * Get or create SSH key for a devbox
 */
export async function getSSHKey(devboxId: string): Promise<SSHKeyInfo | null> {
  try {
    const client = getClient();
    const result = await client.devboxes.createSSHKey(devboxId);

    if (!result || !result.ssh_private_key || !result.url) {
      throw new Error("Failed to create SSH key");
    }

    // Create SSH keys directory
    const sshDir = join(homedir(), ".runloop", "ssh_keys");
    await mkdir(sshDir, { recursive: true });

    // Save private key to file
    const keyfilePath = join(sshDir, `${devboxId}.pem`);
    await writeFile(keyfilePath, result.ssh_private_key, { mode: 0o600 });
    await chmod(keyfilePath, 0o600);

    return {
      keyfilePath,
      privateKey: result.ssh_private_key,
      url: result.url,
    };
  } catch (error) {
    console.error("Failed to create SSH key:", error);
    return null;
  }
}

/**
 * Wait for a devbox to be ready
 */
export async function waitForReady(
  devboxId: string,
  timeoutSeconds: number = 180,
  pollIntervalSeconds: number = 3,
): Promise<boolean> {
  const startTime = Date.now();
  const client = getClient();

  while (true) {
    try {
      const devbox = await client.devboxes.retrieve(devboxId);
      const elapsed = (Date.now() - startTime) / 1000;
      const remaining = timeoutSeconds - elapsed;

      if (devbox.status === "running") {
        console.log(`Devbox ${devboxId} is ready!`);
        return true;
      } else if (devbox.status === "failure") {
        console.log(
          `Devbox ${devboxId} failed to start (status: ${devbox.status})`,
        );
        return false;
      } else if (["shutdown", "suspended"].includes(devbox.status)) {
        console.log(
          `Devbox ${devboxId} is not running (status: ${devbox.status})`,
        );
        return false;
      } else {
        console.log(
          `Devbox ${devboxId} is still ${devbox.status}... (elapsed: ${elapsed.toFixed(0)}s, remaining: ${remaining.toFixed(0)}s)`,
        );

        if (elapsed >= timeoutSeconds) {
          console.log(
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
        console.log(
          `Timeout waiting for devbox ${devboxId} to be ready after ${timeoutSeconds} seconds (error: ${error})`,
        );
        return false;
      }

      console.log(
        `Error checking devbox status: ${error}, retrying in ${pollIntervalSeconds} seconds...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, pollIntervalSeconds * 1000),
      );
    }
  }
}

/**
 * Get SSH URL based on environment
 */
export function getSSHUrl(): string {
  const env = process.env.RUNLOOP_ENV?.toLowerCase();
  return env === "dev" ? "ssh.runloop.pro:443" : "ssh.runloop.ai:443";
}

/**
 * Get proxy command for SSH over HTTPS
 */
export function getProxyCommand(): string {
  const sshUrl = getSSHUrl();
  const sshHost = sshUrl.split(":")[0]; // Extract hostname from "host:port"
  // macOS openssl doesn't support -verify_quiet, use compatible flags
  // servername should be %h (target hostname) - SSH will replace %h with the actual hostname from the SSH command
  return `openssl s_client -quiet -servername %h -connect ${sshUrl} 2>/dev/null`;
}

/**
 * Execute SSH command
 */
export async function executeSSH(
  devboxId: string,
  user: string,
  keyfilePath: string,
  url: string,
  additionalArgs: string[] = [],
): Promise<void> {
  const proxyCommand = getProxyCommand();
  const command = [
    "/usr/bin/ssh",
    "-i",
    keyfilePath,
    "-o",
    `ProxyCommand=${proxyCommand}`,
    "-o",
    "StrictHostKeyChecking=no",
    ...additionalArgs,
    `${user}@${url}`,
  ];

  try {
    const { stdout, stderr } = await execAsync(command.join(" "));
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error("SSH command failed:", error);
    process.exit(1);
  }
}

/**
 * Generate SSH config for a devbox
 */
export function generateSSHConfig(
  devboxId: string,
  user: string,
  keyfilePath: string,
  url: string,
): string {
  const proxyCommand = getProxyCommand();
  return `
Host ${devboxId}
  Hostname ${url}
  User ${user}
  IdentityFile ${keyfilePath}
  StrictHostKeyChecking no
  ProxyCommand ${proxyCommand}
  `.trim();
}

/**
 * Check if SSH tools are available
 */
export async function checkSSHTools(): Promise<boolean> {
  try {
    await execAsync("which ssh");
    await execAsync("which scp");
    await execAsync("which rsync");
    await execAsync("which openssl");
    return true;
  } catch {
    return false;
  }
}

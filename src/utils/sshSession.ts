import { spawnSync } from "child_process";

export interface SSHSessionConfig {
  keyPath: string;
  proxyCommand: string;
  sshUser: string;
  url: string;
  devboxId: string;
  devboxName: string;
}

export interface SSHSessionResult {
  exitCode: number;
  shouldRestart: boolean;
  returnToDevboxId?: string;
}

export async function runSSHSession(
  config: SSHSessionConfig,
): Promise<SSHSessionResult> {
  // Reset terminal to fix input visibility issues
  // This ensures the terminal is in a proper state after exiting Ink
  spawnSync("reset", [], { stdio: "inherit" });

  console.log(`\nConnecting to devbox ${config.devboxName}...\n`);

  // Spawn SSH in foreground with proper terminal settings
  const result = spawnSync(
    "ssh",
    [
      "-t", // Force pseudo-terminal allocation for proper input handling
      "-i",
      config.keyPath,
      "-o",
      `ProxyCommand=${config.proxyCommand}`,
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      "UserKnownHostsFile=/dev/null",
      `${config.sshUser}@${config.url}`,
    ],
    {
      stdio: "inherit",
      shell: false,
    },
  );

  return {
    exitCode: result.status || 0,
    shouldRestart: true,
    returnToDevboxId: config.devboxId,
  };
}

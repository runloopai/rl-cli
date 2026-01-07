/**
 * SSH into devbox command
 */

import { spawn } from "child_process";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { processUtils } from "../../utils/processUtils.js";
import {
  getSSHKey,
  waitForReady,
  generateSSHConfig,
  checkSSHTools,
  getProxyCommand,
} from "../../utils/ssh.js";

interface SSHOptions {
  configOnly?: boolean;
  noWait?: boolean;
  timeout?: number;
  pollInterval?: number;
  output?: string;
}

export async function sshDevbox(devboxId: string, options: SSHOptions = {}) {
  try {
    // Check if SSH tools are available
    const sshToolsAvailable = await checkSSHTools();
    if (!sshToolsAvailable) {
      outputError(
        "SSH tools (ssh, scp, rsync, openssl) are not available on this system",
      );
    }

    const client = getClient();

    // Wait for devbox to be ready unless --no-wait is specified
    if (!options.noWait) {
      console.error(`Waiting for devbox ${devboxId} to be ready...`);
      const isReady = await waitForReady(
        devboxId,
        options.timeout || 180,
        options.pollInterval || 3,
      );
      if (!isReady) {
        outputError(`Devbox ${devboxId} is not ready. Please try again later.`);
      }
    }

    // Get devbox details to determine user
    const devbox = await client.devboxes.retrieve(devboxId);
    const user = devbox.launch_parameters?.user_parameters?.username || "user";

    // Get SSH key
    const sshInfo = await getSSHKey(devboxId);
    if (!sshInfo) {
      outputError("Failed to create SSH key");
    }

    if (options.configOnly) {
      const config = generateSSHConfig(
        devboxId,
        user,
        sshInfo!.keyfilePath,
        sshInfo!.url,
      );
      output({ config }, { format: options.output, defaultFormat: "text" });
      return;
    }

    // If output format is specified, just return the connection info
    if (options.output && options.output !== "text") {
      output(
        {
          devboxId,
          user,
          keyfilePath: sshInfo!.keyfilePath,
          url: sshInfo!.url,
        },
        { format: options.output, defaultFormat: "json" },
      );
      return;
    }

    // Actually start SSH session
    const proxyCommand = getProxyCommand();
    const sshArgs = [
      "-i",
      sshInfo!.keyfilePath,
      "-o",
      `ProxyCommand=${proxyCommand}`,
      "-o",
      "StrictHostKeyChecking=no",
      `${user}@${sshInfo!.url}`,
    ];

    const sshProcess = spawn("/usr/bin/ssh", sshArgs, {
      stdio: "inherit",
    });

    sshProcess.on("close", (code) => {
      processUtils.exit(code || 0);
    });

    sshProcess.on("error", (err) => {
      outputError("SSH connection failed", err);
    });
  } catch (error) {
    outputError("Failed to setup SSH connection", error);
  }
}

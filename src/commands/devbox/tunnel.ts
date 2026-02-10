/**
 * Create SSH tunnel to devbox command
 */

import { spawn } from "child_process";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { processUtils } from "../../utils/processUtils.js";
import { getSSHKey, getProxyCommand, checkSSHTools } from "../../utils/ssh.js";
import { openInBrowser } from "../../utils/browser.js";

interface TunnelOptions {
  ports: string;
  output?: string;
  open?: boolean;
}

export async function createTunnel(devboxId: string, options: TunnelOptions) {
  try {
    // Check if SSH tools are available
    const sshToolsAvailable = await checkSSHTools();
    if (!sshToolsAvailable) {
      outputError("SSH tools (ssh, openssl) are not available on this system");
    }

    if (!options.ports.includes(":")) {
      outputError("Ports must be specified as 'local:remote'");
    }

    const [localPort, remotePort] = options.ports.split(":");

    const client = getClient();

    // Get devbox details to determine user
    const devbox = await client.devboxes.retrieve(devboxId);
    const user = devbox.launch_parameters?.user_parameters?.username || "user";

    // Get SSH key
    const sshInfo = await getSSHKey(devboxId);
    if (!sshInfo) {
      outputError("Failed to create SSH key");
    }

    // If output format is specified, just return the tunnel info
    if (options.output && options.output !== "text") {
      output(
        {
          devboxId,
          localPort,
          remotePort,
          user,
          keyfilePath: sshInfo!.keyfilePath,
        },
        { format: options.output, defaultFormat: "json" },
      );
      return;
    }

    const proxyCommand = getProxyCommand();
    const tunnelArgs = [
      "-i",
      sshInfo!.keyfilePath,
      "-o",
      `ProxyCommand=${proxyCommand}`,
      "-o",
      "StrictHostKeyChecking=no",
      "-N", // Do not execute a remote command
      "-L",
      `${localPort}:localhost:${remotePort}`,
      `${user}@${sshInfo!.url}`,
    ];

    const tunnelUrl = `http://localhost:${localPort}`;
    console.log(
      `Starting tunnel: local port ${localPort} -> remote port ${remotePort}`,
    );
    console.log(`Tunnel URL: ${tunnelUrl}`);
    console.log("Press Ctrl+C to stop the tunnel.");

    const tunnelProcess = spawn("/usr/bin/ssh", tunnelArgs, {
      stdio: "inherit",
    });

    // Open browser if --open flag is set
    if (options.open) {
      // Small delay to let the tunnel establish
      setTimeout(() => {
        openInBrowser(tunnelUrl);
      }, 1000); // TODO: Not going to need this soon with tunnels v2
    }

    tunnelProcess.on("close", (code) => {
      console.log("\nTunnel closed.");
      processUtils.exit(code || 0);
    });

    tunnelProcess.on("error", (err) => {
      outputError("Tunnel creation failed", err);
    });
  } catch (error) {
    outputError("Failed to create SSH tunnel", error);
  }
}

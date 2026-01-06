/**
 * SCP files to/from devbox command
 */

import { exec } from "child_process";
import { promisify } from "util";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { getSSHKey, getProxyCommand, checkSSHTools } from "../../utils/ssh.js";

const execAsync = promisify(exec);

interface SCPOptions {
  src: string;
  dst: string;
  scpOptions?: string;
  output?: string;
}

export async function scpFiles(devboxId: string, options: SCPOptions) {
  try {
    // Check if SSH tools are available
    const sshToolsAvailable = await checkSSHTools();
    if (!sshToolsAvailable) {
      outputError(
        "SSH tools (ssh, scp, openssl) are not available on this system",
      );
    }

    const client = getClient();

    // Get devbox details to determine user
    const devbox = await client.devboxes.retrieve(devboxId);
    const user = devbox.launch_parameters?.user_parameters?.username || "user";

    // Get SSH key
    const sshInfo = await getSSHKey(devboxId);
    if (!sshInfo) {
      outputError("Failed to create SSH key");
    }

    const proxyCommand = getProxyCommand();
    const scpCommand = [
      "scp",
      "-i",
      sshInfo!.keyfilePath,
      "-o",
      `ProxyCommand=${proxyCommand}`,
      "-o",
      "StrictHostKeyChecking=no",
    ];

    if (options.scpOptions) {
      scpCommand.push(...options.scpOptions.split(" "));
    }

    // Handle remote paths (starting with :)
    if (options.src.startsWith(":")) {
      scpCommand.push(`${user}@${sshInfo!.url}:${options.src.slice(1)}`);
      scpCommand.push(options.dst);
    } else {
      scpCommand.push(options.src);
      if (options.dst.startsWith(":")) {
        scpCommand.push(`${user}@${sshInfo!.url}:${options.dst.slice(1)}`);
      } else {
        scpCommand.push(options.dst);
      }
    }

    await execAsync(scpCommand.join(" "));

    // Default: just output the destination for easy scripting
    if (!options.output || options.output === "text") {
      console.log(options.dst);
    } else {
      output(
        {
          source: options.src,
          destination: options.dst,
        },
        { format: options.output, defaultFormat: "json" },
      );
    }
  } catch (error) {
    outputError("SCP operation failed", error);
  }
}

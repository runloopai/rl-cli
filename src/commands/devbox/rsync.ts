/**
 * Rsync files to/from devbox command
 */

import { exec } from "child_process";
import { promisify } from "util";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { getSSHKey, getProxyCommand, checkSSHTools } from "../../utils/ssh.js";

const execAsync = promisify(exec);

interface RsyncOptions {
  src: string;
  dst: string;
  rsyncOptions?: string;
  output?: string;
}

export async function rsyncFiles(devboxId: string, options: RsyncOptions) {
  try {
    // Check if SSH tools are available
    const sshToolsAvailable = await checkSSHTools();
    if (!sshToolsAvailable) {
      outputError("SSH tools (ssh, rsync, openssl) are not available on this system");
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
    const sshOptions = `-i ${sshInfo!.keyfilePath} -o ProxyCommand='${proxyCommand}' -o StrictHostKeyChecking=no`;

    const rsyncCommand = [
      "rsync",
      "-vrz", // v: verbose, r: recursive, z: compress
      "-e", `"ssh ${sshOptions}"`,
    ];

    if (options.rsyncOptions) {
      rsyncCommand.push(...options.rsyncOptions.split(" "));
    }

    // Handle remote paths (starting with :)
    if (options.src.startsWith(":")) {
      rsyncCommand.push(`${user}@${sshInfo!.url}:${options.src.slice(1)}`);
      rsyncCommand.push(options.dst);
    } else {
      rsyncCommand.push(options.src);
      if (options.dst.startsWith(":")) {
        rsyncCommand.push(`${user}@${sshInfo!.url}:${options.dst.slice(1)}`);
      } else {
        rsyncCommand.push(options.dst);
      }
    }

    await execAsync(rsyncCommand.join(" "));
    
    // Default: just output the destination for easy scripting
    if (!options.output || options.output === "text") {
      console.log(options.dst);
    } else {
      output({
        source: options.src,
        destination: options.dst,
      }, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Rsync operation failed", error);
  }
}

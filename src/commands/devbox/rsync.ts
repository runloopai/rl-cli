/**
 * Rsync files to/from devbox command
 *
 * Supports standard rsync-like syntax where the devbox ID (dbx_*) is used as a hostname:
 *   rli devbox rsync dbx_abc123:/remote/path ./local/path          # download
 *   rli devbox rsync ./local/path dbx_abc123:/remote/path          # upload
 *   rli devbox rsync root@dbx_abc123:/remote/path ./local/path     # explicit user
 *
 * If no user is specified for a remote path, the devbox's configured user is used.
 * Paths without a dbx_ hostname are treated as local paths.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { output, outputError } from "../../utils/output.js";
import { getProxyCommand, checkSSHTools } from "../../utils/ssh.js";
import { parseSCPPath, resolveRemote, type ParsedSCPPath } from "./scp.js";

const execFileAsync = promisify(execFile);

export interface RsyncOptions {
  rsyncOptions?: string;
  output?: string;
}

/**
 * Build the rsync command for a single-remote transfer (local <-> devbox).
 */
export function buildRsyncCommand(opts: {
  sshInfo: { keyfilePath: string; url: string };
  proxyCommand: string;
  parsedSrc: ParsedSCPPath;
  parsedDst: ParsedSCPPath;
  defaultUser: string;
  rsyncOptions?: string;
}): string[] {
  const sshTransport = `ssh -i ${opts.sshInfo.keyfilePath} -o ProxyCommand=${opts.proxyCommand} -o StrictHostKeyChecking=no`;

  const rsyncCommand = [
    "rsync",
    "-vrz", // v: verbose, r: recursive, z: compress
    "-e",
    sshTransport,
  ];

  if (opts.rsyncOptions) {
    rsyncCommand.push(...opts.rsyncOptions.split(" "));
  }

  // Build src argument
  if (opts.parsedSrc.isRemote) {
    const user = opts.parsedSrc.user || opts.defaultUser;
    rsyncCommand.push(`${user}@${opts.sshInfo.url}:${opts.parsedSrc.path}`);
  } else {
    rsyncCommand.push(opts.parsedSrc.path);
  }

  // Build dst argument
  if (opts.parsedDst.isRemote) {
    const user = opts.parsedDst.user || opts.defaultUser;
    rsyncCommand.push(`${user}@${opts.sshInfo.url}:${opts.parsedDst.path}`);
  } else {
    rsyncCommand.push(opts.parsedDst.path);
  }

  return rsyncCommand;
}

export async function rsyncFiles(
  src: string,
  dst: string,
  options: RsyncOptions,
) {
  try {
    // Check if SSH tools are available
    const sshToolsAvailable = await checkSSHTools();
    if (!sshToolsAvailable) {
      outputError(
        "SSH tools (ssh, rsync, openssl) are not available on this system",
      );
    }

    const parsedSrc = parseSCPPath(src);
    const parsedDst = parseSCPPath(dst);

    if (!parsedSrc.isRemote && !parsedDst.isRemote) {
      outputError(
        "At least one of src or dst must be a remote devbox path (e.g. dbx_<id>:/path)",
      );
    }

    if (parsedSrc.isRemote && parsedDst.isRemote) {
      outputError(
        "Devbox-to-devbox rsync is not supported. Only one side can be a remote devbox path.",
      );
    }

    const devboxId = parsedSrc.isRemote ? parsedSrc.host! : parsedDst.host!;
    const remote = await resolveRemote(devboxId);
    const proxyCommand = getProxyCommand();

    const rsyncCommand = buildRsyncCommand({
      sshInfo: remote.sshInfo,
      proxyCommand,
      parsedSrc,
      parsedDst,
      defaultUser: remote.defaultUser,
      rsyncOptions: options.rsyncOptions,
    });

    const [cmd, ...args] = rsyncCommand;
    await execFileAsync(cmd, args);

    // Default: just output the destination for easy scripting
    if (!options.output || options.output === "text") {
      console.log(dst);
    } else {
      output(
        {
          source: src,
          destination: dst,
        },
        { format: options.output, defaultFormat: "json" },
      );
    }
  } catch (error) {
    outputError("Rsync operation failed", error);
  }
}

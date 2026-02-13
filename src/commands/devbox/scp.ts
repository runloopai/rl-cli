/**
 * SCP files to/from devbox command
 *
 * Supports standard SCP-like syntax where the devbox ID (dbx_*) is used as a hostname:
 *   rli devbox scp dbx_abc123:/remote/path ./local/path          # download
 *   rli devbox scp ./local/path dbx_abc123:/remote/path          # upload
 *   rli devbox scp root@dbx_abc123:/remote/path ./local/path     # explicit user
 *   rli devbox scp dbx_src:/file dbx_dst:/file                   # devbox-to-devbox
 *
 * If no user is specified for a remote path, the devbox's configured user is used.
 * Paths without a dbx_ hostname are treated as local paths.
 *
 * Devbox-to-devbox transfers use scp -3 to route data through the local machine,
 * with a temporary SSH config so each devbox uses its own key.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import {
  getSSHKey,
  getProxyCommand,
  checkSSHTools,
  SSHKeyInfo,
} from "../../utils/ssh.js";

const execFileAsync = promisify(execFile);

export interface SCPOptions {
  scpOptions?: string;
  output?: string;
}

export interface ParsedSCPPath {
  user?: string;
  host?: string;
  path: string;
  isRemote: boolean;
}

/**
 * Resolved info for a remote devbox endpoint.
 */
export interface ResolvedRemote {
  devboxId: string;
  defaultUser: string;
  sshInfo: SSHKeyInfo;
}

/**
 * Parse an SCP-style path into its components.
 *
 * Supported formats:
 *   user@dbx_id:path  -> remote with explicit user
 *   dbx_id:path       -> remote with default user
 *   /local/path       -> local (absolute)
 *   ./relative        -> local (relative)
 *   filename          -> local (bare filename, no colon)
 */
export function parseSCPPath(input: string): ParsedSCPPath {
  // Match [user@]host:path where host is a devbox ID (dbx_*).
  // This avoids false positives on local paths that happen to contain colons.
  const match = input.match(/^(?:([^@/:]+)@)?(dbx_[^@/:]+):(.*)$/);
  if (match) {
    return {
      user: match[1] || undefined,
      host: match[2],
      path: match[3],
      isRemote: true,
    };
  }
  return { path: input, isRemote: false };
}

/**
 * Resolve a devbox ID to its SSH info and default user.
 */
async function resolveRemote(devboxId: string): Promise<ResolvedRemote> {
  const client = getClient();
  const devbox = await client.devboxes.retrieve(devboxId);
  const defaultUser =
    devbox.launch_parameters?.user_parameters?.username || "user";

  const sshInfo = await getSSHKey(devboxId);
  if (!sshInfo) {
    throw new Error(`Failed to create SSH key for ${devboxId}`);
  }

  return { devboxId, defaultUser, sshInfo };
}

/**
 * Build the SCP command for a single-remote transfer (local <-> devbox).
 */
export function buildSCPCommand(opts: {
  sshInfo: { keyfilePath: string; url: string };
  proxyCommand: string;
  parsedSrc: ParsedSCPPath;
  parsedDst: ParsedSCPPath;
  defaultUser: string;
  scpOptions?: string;
}): string[] {
  const scpCommand = [
    "scp",
    "-i",
    opts.sshInfo.keyfilePath,
    "-o",
    `ProxyCommand=${opts.proxyCommand}`,
    "-o",
    "StrictHostKeyChecking=no",
  ];

  if (opts.scpOptions) {
    scpCommand.push(...opts.scpOptions.split(" "));
  }

  // Build src argument
  if (opts.parsedSrc.isRemote) {
    const user = opts.parsedSrc.user || opts.defaultUser;
    scpCommand.push(`${user}@${opts.sshInfo.url}:${opts.parsedSrc.path}`);
  } else {
    scpCommand.push(opts.parsedSrc.path);
  }

  // Build dst argument
  if (opts.parsedDst.isRemote) {
    const user = opts.parsedDst.user || opts.defaultUser;
    scpCommand.push(`${user}@${opts.sshInfo.url}:${opts.parsedDst.path}`);
  } else {
    scpCommand.push(opts.parsedDst.path);
  }

  return scpCommand;
}

/**
 * Build the SCP command for a dual-remote transfer (devbox -> devbox).
 * Uses scp -3 to route data through the local machine and a temporary
 * SSH config file so each devbox resolves to its own key/proxy.
 */
export function buildDualRemoteSCPCommand(opts: {
  srcRemote: ResolvedRemote;
  dstRemote: ResolvedRemote;
  proxyCommand: string;
  parsedSrc: ParsedSCPPath;
  parsedDst: ParsedSCPPath;
  sshConfigPath: string;
  scpOptions?: string;
}): string[] {
  const scpCommand = [
    "scp",
    "-3",
    "-F",
    opts.sshConfigPath,
    "-o",
    "StrictHostKeyChecking=no",
  ];

  if (opts.scpOptions) {
    scpCommand.push(...opts.scpOptions.split(" "));
  }

  const srcUser = opts.parsedSrc.user || opts.srcRemote.defaultUser;
  scpCommand.push(
    `${srcUser}@${opts.srcRemote.sshInfo.url}:${opts.parsedSrc.path}`,
  );

  const dstUser = opts.parsedDst.user || opts.dstRemote.defaultUser;
  scpCommand.push(
    `${dstUser}@${opts.dstRemote.sshInfo.url}:${opts.parsedDst.path}`,
  );

  return scpCommand;
}

/**
 * Generate a temporary SSH config file for dual-remote transfers.
 * Maps each devbox URL to its identity file and proxy command.
 */
export function generateSCPConfig(
  remotes: ResolvedRemote[],
  proxyCommand: string,
): string {
  return remotes
    .map(
      (r) =>
        `Host ${r.sshInfo.url}\n` +
        `  IdentityFile ${r.sshInfo.keyfilePath}\n` +
        `  ProxyCommand ${proxyCommand}\n` +
        `  StrictHostKeyChecking no`,
    )
    .join("\n\n");
}

export async function scpFiles(src: string, dst: string, options: SCPOptions) {
  try {
    // Check if SSH tools are available
    const sshToolsAvailable = await checkSSHTools();
    if (!sshToolsAvailable) {
      outputError(
        "SSH tools (ssh, scp, openssl) are not available on this system",
      );
    }

    const parsedSrc = parseSCPPath(src);
    const parsedDst = parseSCPPath(dst);

    if (!parsedSrc.isRemote && !parsedDst.isRemote) {
      outputError(
        "At least one of src or dst must be a remote devbox path (e.g. dbx_<id>:/path)",
      );
    }

    const proxyCommand = getProxyCommand();

    let scpCommand: string[];

    if (parsedSrc.isRemote && parsedDst.isRemote) {
      // Both sides are remote devboxes — resolve both in parallel
      const [srcRemote, dstRemote] = await Promise.all([
        resolveRemote(parsedSrc.host!),
        resolveRemote(parsedDst.host!),
      ]);

      // Write a temporary SSH config so scp can find the right key per host
      const configContent = generateSCPConfig(
        [srcRemote, dstRemote],
        proxyCommand,
      );
      const configPath = join(tmpdir(), `rli-scp-${randomUUID()}.conf`);
      const configHeader =
        "# Temporary SSH config generated by `rli devbox scp` for a dual-remote transfer.\n" +
        "# Safe to delete.\n\n";
      await writeFile(configPath, configHeader + configContent, {
        mode: 0o600,
      });

      try {
        scpCommand = buildDualRemoteSCPCommand({
          srcRemote,
          dstRemote,
          proxyCommand,
          parsedSrc,
          parsedDst,
          sshConfigPath: configPath,
          scpOptions: options.scpOptions,
        });

        const [cmd, ...args] = scpCommand;
        await execFileAsync(cmd, args);
      } finally {
        // Clean up temp config
        await unlink(configPath).catch(() => {});
      }
    } else {
      // Single remote — one side is local
      const devboxId = parsedSrc.isRemote ? parsedSrc.host! : parsedDst.host!;
      const remote = await resolveRemote(devboxId);

      scpCommand = buildSCPCommand({
        sshInfo: remote.sshInfo,
        proxyCommand,
        parsedSrc,
        parsedDst,
        defaultUser: remote.defaultUser,
        scpOptions: options.scpOptions,
      });

      const [cmd, ...args] = scpCommand;
      await execFileAsync(cmd, args);
    }

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
    outputError("SCP operation failed", error);
  }
}

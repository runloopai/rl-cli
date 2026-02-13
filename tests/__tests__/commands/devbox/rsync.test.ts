/**
 * Tests for devbox rsync command
 *
 * Covers buildRsyncCommand (command construction with parsed paths).
 * Path parsing is tested in scp.test.ts since rsync reuses parseSCPPath.
 */

import { describe, it, expect } from "@jest/globals";
import { parseSCPPath } from "@/commands/devbox/scp.js";
import { buildRsyncCommand } from "@/commands/devbox/rsync.js";

// ── buildRsyncCommand ───────────────────────────────────────────────────

describe("buildRsyncCommand", () => {
  const sshInfo = {
    keyfilePath: "/tmp/key.pem",
    url: "dbx_abc123.runloop.dev",
  };
  const proxyCommand =
    "openssl s_client -quiet -servername %h -connect ssh.runloop.dev:443 2>/dev/null";

  it("should build command for remote src → local dst with default user", () => {
    const cmd = buildRsyncCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:/home/devuser/data/"),
      parsedDst: parseSCPPath("./data/"),
      defaultUser: "devuser",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain("rsync");
    expect(joined).toContain("-vrz");
    expect(joined).toContain(
      "devuser@dbx_abc123.runloop.dev:/home/devuser/data/",
    );
    expect(joined).toContain("./data/");
  });

  it("should build command for local src → remote dst with default user", () => {
    const cmd = buildRsyncCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("./data/"),
      parsedDst: parseSCPPath("dbx_abc123:/home/devuser/data/"),
      defaultUser: "devuser",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain("./data/");
    expect(joined).toContain(
      "devuser@dbx_abc123.runloop.dev:/home/devuser/data/",
    );
    // Ensure local path comes before remote path in the command
    expect(joined.indexOf("./data/")).toBeLessThan(
      joined.indexOf("devuser@dbx_abc123.runloop.dev"),
    );
  });

  it("should use explicit user when specified in remote path", () => {
    const cmd = buildRsyncCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("root@dbx_abc123:/etc/config/"),
      parsedDst: parseSCPPath("./config/"),
      defaultUser: "devuser",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain("root@dbx_abc123.runloop.dev:/etc/config/");
    expect(joined).not.toContain("devuser@");
  });

  it("should use default user when no user is specified in remote path", () => {
    const cmd = buildRsyncCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:/data/"),
      parsedDst: parseSCPPath("/tmp/data/"),
      defaultUser: "custom-user",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain("custom-user@dbx_abc123.runloop.dev:/data/");
  });

  it("should include additional rsync options when provided", () => {
    const cmd = buildRsyncCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:/data/"),
      parsedDst: parseSCPPath("/tmp/data/"),
      defaultUser: "user",
      rsyncOptions: "--delete --exclude=node_modules",
    });

    expect(cmd).toContain("--delete");
    expect(cmd).toContain("--exclude=node_modules");
  });

  it("should include SSH transport with key, proxy, and host checking", () => {
    const cmd = buildRsyncCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:/data/"),
      parsedDst: parseSCPPath("/tmp/data/"),
      defaultUser: "user",
    });

    // The -e argument should be a single string containing the full ssh command
    const eIdx = cmd.indexOf("-e");
    expect(eIdx).toBeGreaterThan(-1);
    const sshTransport = cmd[eIdx + 1];
    expect(sshTransport).toContain("ssh");
    expect(sshTransport).toContain("-i /tmp/key.pem");
    expect(sshTransport).toContain(`ProxyCommand=${proxyCommand}`);
    expect(sshTransport).toContain("StrictHostKeyChecking=no");
  });

  it("should include -vrz flags for verbose, recursive, and compressed transfer", () => {
    const cmd = buildRsyncCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:/data/"),
      parsedDst: parseSCPPath("/tmp/data/"),
      defaultUser: "user",
    });

    expect(cmd).toContain("-vrz");
  });

  it("should handle remote src with empty path (home directory)", () => {
    const cmd = buildRsyncCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:"),
      parsedDst: parseSCPPath("/tmp/backup/"),
      defaultUser: "user",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain("user@dbx_abc123.runloop.dev:");
  });
});

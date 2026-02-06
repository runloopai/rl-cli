/**
 * Tests for devbox scp command
 *
 * Covers parseSCPPath (path parsing), buildSCPCommand (single-remote),
 * buildDualRemoteSCPCommand (devbox-to-devbox), and generateSCPConfig.
 */

import { describe, it, expect } from "@jest/globals";
import {
  parseSCPPath,
  buildSCPCommand,
  buildDualRemoteSCPCommand,
  generateSCPConfig,
  type ResolvedRemote,
} from "@/commands/devbox/scp.js";

// ── parseSCPPath ────────────────────────────────────────────────────────

describe("parseSCPPath", () => {
  it("should parse dbx_id:path as remote with default user", () => {
    const result = parseSCPPath("dbx_abc123:/home/user/file.txt");
    expect(result).toEqual({
      host: "dbx_abc123",
      path: "/home/user/file.txt",
      isRemote: true,
      user: undefined,
    });
  });

  it("should parse user@dbx_id:path as remote with explicit user", () => {
    const result = parseSCPPath("root@dbx_abc123:/etc/config");
    expect(result).toEqual({
      user: "root",
      host: "dbx_abc123",
      path: "/etc/config",
      isRemote: true,
    });
  });

  it("should parse dbx_id: with empty path as remote (home directory)", () => {
    const result = parseSCPPath("dbx_abc123:");
    expect(result).toEqual({
      host: "dbx_abc123",
      path: "",
      isRemote: true,
      user: undefined,
    });
  });

  it("should parse absolute path as local", () => {
    const result = parseSCPPath("/tmp/file.txt");
    expect(result).toEqual({ path: "/tmp/file.txt", isRemote: false });
  });

  it("should parse relative path as local", () => {
    const result = parseSCPPath("./myfile.txt");
    expect(result).toEqual({ path: "./myfile.txt", isRemote: false });
  });

  it("should parse bare filename as local", () => {
    const result = parseSCPPath("file.txt");
    expect(result).toEqual({ path: "file.txt", isRemote: false });
  });

  it("should treat path with slash before colon as local", () => {
    const result = parseSCPPath("./dir:name");
    expect(result).toEqual({ path: "./dir:name", isRemote: false });
  });

  it("should not treat a path with @ and / before colon as remote", () => {
    const result = parseSCPPath("./user@host:file");
    expect(result).toEqual({ path: "./user@host:file", isRemote: false });
  });

  it("should treat non-dbx hostname:path as local (not a devbox)", () => {
    // A regular hostname like "myserver:/path" should NOT be treated as remote
    const result = parseSCPPath("myserver:/some/path");
    expect(result).toEqual({ path: "myserver:/some/path", isRemote: false });
  });

  it("should only match hosts starting with dbx_", () => {
    // "notdbx_123:/path" should be local
    const result = parseSCPPath("notdbx_123:/path");
    expect(result).toEqual({ path: "notdbx_123:/path", isRemote: false });
  });
});

// ── buildSCPCommand ─────────────────────────────────────────────────────

describe("buildSCPCommand", () => {
  const sshInfo = {
    keyfilePath: "/tmp/key.pem",
    url: "dbx_abc123.runloop.dev",
  };
  const proxyCommand =
    "openssl s_client -quiet -servername %h -connect ssh.runloop.dev:443 2>/dev/null";

  it("should build command for remote src → local dst with default user", () => {
    const cmd = buildSCPCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:/home/devuser/data.txt"),
      parsedDst: parseSCPPath("/tmp/data.txt"),
      defaultUser: "devuser",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain("scp");
    expect(joined).toContain("-i /tmp/key.pem");
    expect(joined).toContain(
      "devuser@dbx_abc123.runloop.dev:/home/devuser/data.txt",
    );
    expect(joined).toContain("/tmp/data.txt");
  });

  it("should build command for local src → remote dst with default user", () => {
    const cmd = buildSCPCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("/tmp/upload.txt"),
      parsedDst: parseSCPPath("dbx_abc123:/home/devuser/upload.txt"),
      defaultUser: "devuser",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain("/tmp/upload.txt");
    expect(joined).toContain(
      "devuser@dbx_abc123.runloop.dev:/home/devuser/upload.txt",
    );
    // Ensure local path comes before remote path in the command
    expect(joined.indexOf("/tmp/upload.txt")).toBeLessThan(
      joined.indexOf("devuser@dbx_abc123.runloop.dev"),
    );
  });

  it("should use explicit user when specified in remote path", () => {
    const cmd = buildSCPCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("root@dbx_abc123:/etc/hosts"),
      parsedDst: parseSCPPath("/tmp/hosts"),
      defaultUser: "devuser",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain("root@dbx_abc123.runloop.dev:/etc/hosts");
    expect(joined).not.toContain("devuser@");
  });

  it("should use default user when no user is specified in remote path", () => {
    const cmd = buildSCPCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:/file"),
      parsedDst: parseSCPPath("/tmp/file"),
      defaultUser: "custom-user",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain(
      "custom-user@dbx_abc123.runloop.dev:/file",
    );
  });

  it("should include additional scp options when provided", () => {
    const cmd = buildSCPCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:/file"),
      parsedDst: parseSCPPath("/tmp/file"),
      defaultUser: "user",
      scpOptions: "-r -v",
    });

    expect(cmd).toContain("-r");
    expect(cmd).toContain("-v");
  });

  it("should include ProxyCommand and StrictHostKeyChecking options", () => {
    const cmd = buildSCPCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:/file"),
      parsedDst: parseSCPPath("/tmp/file"),
      defaultUser: "user",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain(`ProxyCommand=${proxyCommand}`);
    expect(joined).toContain("StrictHostKeyChecking=no");
  });

  it("should include SSH key path", () => {
    const cmd = buildSCPCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:/file"),
      parsedDst: parseSCPPath("/tmp/file"),
      defaultUser: "user",
    });

    expect(cmd).toContain("-i");
    expect(cmd).toContain("/tmp/key.pem");
  });

  it("should handle remote src with empty path (home directory)", () => {
    const cmd = buildSCPCommand({
      sshInfo,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_abc123:"),
      parsedDst: parseSCPPath("/tmp/file"),
      defaultUser: "user",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain("user@dbx_abc123.runloop.dev:");
  });
});

// ── buildDualRemoteSCPCommand (devbox-to-devbox) ────────────────────────

describe("buildDualRemoteSCPCommand", () => {
  const proxyCommand =
    "openssl s_client -quiet -servername %h -connect ssh.runloop.dev:443 2>/dev/null";

  const srcRemote: ResolvedRemote = {
    devboxId: "dbx_src111",
    defaultUser: "srcuser",
    sshInfo: {
      keyfilePath: "/tmp/dbx_src111.pem",
      privateKey: "src-key",
      url: "dbx_src111.runloop.dev",
    },
  };

  const dstRemote: ResolvedRemote = {
    devboxId: "dbx_dst222",
    defaultUser: "dstuser",
    sshInfo: {
      keyfilePath: "/tmp/dbx_dst222.pem",
      privateKey: "dst-key",
      url: "dbx_dst222.runloop.dev",
    },
  };

  it("should include -3 flag to route through local machine", () => {
    const cmd = buildDualRemoteSCPCommand({
      srcRemote,
      dstRemote,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_src111:/data/file.txt"),
      parsedDst: parseSCPPath("dbx_dst222:/data/file.txt"),
      sshConfigPath: "/tmp/scp.conf",
    });

    expect(cmd).toContain("-3");
  });

  it("should reference the SSH config file with -F", () => {
    const cmd = buildDualRemoteSCPCommand({
      srcRemote,
      dstRemote,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_src111:/file"),
      parsedDst: parseSCPPath("dbx_dst222:/file"),
      sshConfigPath: "/tmp/scp.conf",
    });

    const fIdx = cmd.indexOf("-F");
    expect(fIdx).toBeGreaterThan(-1);
    expect(cmd[fIdx + 1]).toBe("/tmp/scp.conf");
  });

  it("should use each devbox's default user", () => {
    const cmd = buildDualRemoteSCPCommand({
      srcRemote,
      dstRemote,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_src111:/file"),
      parsedDst: parseSCPPath("dbx_dst222:/file"),
      sshConfigPath: "/tmp/scp.conf",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain("srcuser@dbx_src111.runloop.dev:/file");
    expect(joined).toContain("dstuser@dbx_dst222.runloop.dev:/file");
  });

  it("should use explicit user when specified in path", () => {
    const cmd = buildDualRemoteSCPCommand({
      srcRemote,
      dstRemote,
      proxyCommand,
      parsedSrc: parseSCPPath("root@dbx_src111:/etc/hosts"),
      parsedDst: parseSCPPath("admin@dbx_dst222:/etc/hosts"),
      sshConfigPath: "/tmp/scp.conf",
    });

    const joined = cmd.join(" ");
    expect(joined).toContain("root@dbx_src111.runloop.dev:/etc/hosts");
    expect(joined).toContain("admin@dbx_dst222.runloop.dev:/etc/hosts");
    expect(joined).not.toContain("srcuser@");
    expect(joined).not.toContain("dstuser@");
  });

  it("should include additional scp options", () => {
    const cmd = buildDualRemoteSCPCommand({
      srcRemote,
      dstRemote,
      proxyCommand,
      parsedSrc: parseSCPPath("dbx_src111:/file"),
      parsedDst: parseSCPPath("dbx_dst222:/file"),
      sshConfigPath: "/tmp/scp.conf",
      scpOptions: "-r -v",
    });

    expect(cmd).toContain("-r");
    expect(cmd).toContain("-v");
  });
});

// ── generateSCPConfig ───────────────────────────────────────────────────

describe("generateSCPConfig", () => {
  const proxyCommand =
    "openssl s_client -quiet -servername %h -connect ssh.runloop.dev:443 2>/dev/null";

  it("should generate config entries for each remote", () => {
    const remotes: ResolvedRemote[] = [
      {
        devboxId: "dbx_aaa",
        defaultUser: "user1",
        sshInfo: {
          keyfilePath: "/keys/dbx_aaa.pem",
          privateKey: "k1",
          url: "dbx_aaa.runloop.dev",
        },
      },
      {
        devboxId: "dbx_bbb",
        defaultUser: "user2",
        sshInfo: {
          keyfilePath: "/keys/dbx_bbb.pem",
          privateKey: "k2",
          url: "dbx_bbb.runloop.dev",
        },
      },
    ];

    const config = generateSCPConfig(remotes, proxyCommand);

    expect(config).toContain("Host dbx_aaa.runloop.dev");
    expect(config).toContain("IdentityFile /keys/dbx_aaa.pem");
    expect(config).toContain("Host dbx_bbb.runloop.dev");
    expect(config).toContain("IdentityFile /keys/dbx_bbb.pem");
    expect(config).toContain(`ProxyCommand ${proxyCommand}`);
    expect(config).toContain("StrictHostKeyChecking no");
  });
});

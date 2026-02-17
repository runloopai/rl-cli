/**
 * End-to-end tests for scp and rsync commands.
 *
 * These tests create a real devbox, transfer files, and verify the results.
 * Run with: pnpm test:e2e
 *
 * Requires a valid RUNLOOP_API_KEY (e.g. via `rldev`).
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import Runloop from "@runloop/api-client";
import { getClient } from "@/utils/client.js";
import { scpFiles } from "@/commands/devbox/scp.js";
import { rsyncFiles } from "@/commands/devbox/rsync.js";

// Unique prefix for this test run to avoid collisions
const RUN_ID = randomUUID().slice(0, 8);
const REMOTE_DIR = `/tmp/e2e-${RUN_ID}`;

let client: Runloop;
let devboxId: string;

// ── helpers ──────────────────────────────────────────────────────────────

/** Create a temporary directory with a unique name. */
function makeTempDir(label: string): string {
  const dir = join(tmpdir(), `rli-e2e-${RUN_ID}-${label}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Run a command on the devbox and return stdout (trimmed). */
async function execOnDevbox(command: string): Promise<string> {
  const result = await client.devboxes.executeSync(devboxId, { command });
  return (result as any).stdout?.trim() ?? "";
}

/** Poll until devbox reaches a target status. */
async function waitForStatus(
  targetStatus: string,
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const devbox = await client.devboxes.retrieve(devboxId);
    if (devbox.status === targetStatus) return;
    await new Promise((r) => setTimeout(r, 3_000));
  }
  throw new Error(
    `Devbox ${devboxId} did not reach status "${targetStatus}" within ${timeoutMs}ms`,
  );
}

// ── lifecycle ────────────────────────────────────────────────────────────

beforeAll(async () => {
  client = getClient();

  // Create a small devbox
  const devbox = await client.devboxes.create({
    entrypoint: "sleep infinity",
    launch_parameters: {
      keep_alive_time_seconds: 300,
    },
  });
  devboxId = devbox.id;
  console.log(`Created devbox ${devboxId}, waiting for it to be running…`);

  await waitForStatus("running");
  console.log(`Devbox ${devboxId} is running.`);

  // Create the remote test directory
  await execOnDevbox(`mkdir -p ${REMOTE_DIR}`);
});

afterAll(async () => {
  if (devboxId) {
    console.log(`Shutting down devbox ${devboxId}…`);
    await client.devboxes.shutdown(devboxId).catch(() => {});
  }
});

// ── SCP tests ────────────────────────────────────────────────────────────

describe("scp e2e", () => {
  const TEST_CONTENT = `hello from scp e2e test ${RUN_ID}`;

  it("should upload a file to the devbox", async () => {
    const localDir = makeTempDir("scp-upload");
    const localFile = join(localDir, "upload.txt");
    writeFileSync(localFile, TEST_CONTENT);

    const remotePath = `${REMOTE_DIR}/upload.txt`;
    await scpFiles(localFile, `${devboxId}:${remotePath}`, {});

    // Verify the file landed on the devbox
    const remoteContent = await execOnDevbox(`cat ${remotePath}`);
    expect(remoteContent).toBe(TEST_CONTENT);

    rmSync(localDir, { recursive: true, force: true });
  });

  it("should download a file from the devbox", async () => {
    const remotePath = `${REMOTE_DIR}/download-src.txt`;
    await execOnDevbox(`echo -n '${TEST_CONTENT}' > ${remotePath}`);

    const localDir = makeTempDir("scp-download");
    const localFile = join(localDir, "download.txt");

    await scpFiles(`${devboxId}:${remotePath}`, localFile, {});

    expect(existsSync(localFile)).toBe(true);
    expect(readFileSync(localFile, "utf-8")).toBe(TEST_CONTENT);

    rmSync(localDir, { recursive: true, force: true });
  });
});

// ── Rsync tests ──────────────────────────────────────────────────────────

describe("rsync e2e", () => {
  it("should upload a directory to the devbox", async () => {
    const localDir = makeTempDir("rsync-upload");
    writeFileSync(join(localDir, "a.txt"), "file-a");
    writeFileSync(join(localDir, "b.txt"), "file-b");

    const remoteSubdir = `${REMOTE_DIR}/rsync-up/`;
    await execOnDevbox(`mkdir -p ${remoteSubdir}`);

    // Trailing slash on src means "contents of this directory"
    await rsyncFiles(`${localDir}/`, `${devboxId}:${remoteSubdir}`, {});

    const remoteA = await execOnDevbox(`cat ${remoteSubdir}a.txt`);
    const remoteB = await execOnDevbox(`cat ${remoteSubdir}b.txt`);
    expect(remoteA).toBe("file-a");
    expect(remoteB).toBe("file-b");

    rmSync(localDir, { recursive: true, force: true });
  });

  it("should download a directory from the devbox", async () => {
    const remoteSubdir = `${REMOTE_DIR}/rsync-down/`;
    await execOnDevbox(
      `mkdir -p ${remoteSubdir} && echo -n 'x-data' > ${remoteSubdir}x.txt && echo -n 'y-data' > ${remoteSubdir}y.txt`,
    );

    const localDir = makeTempDir("rsync-download");

    await rsyncFiles(`${devboxId}:${remoteSubdir}`, `${localDir}/`, {});

    expect(readFileSync(join(localDir, "x.txt"), "utf-8")).toBe("x-data");
    expect(readFileSync(join(localDir, "y.txt"), "utf-8")).toBe("y-data");

    rmSync(localDir, { recursive: true, force: true });
  });
});

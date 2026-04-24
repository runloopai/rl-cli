/**
 * Tests for object upload command - tar/tgz archive creation and validation
 */

import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, writeFile, mkdir, rm, chmod, utimes } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { parseTar } from "nanotar";

// Mock client and output
const mockCreate = jest.fn();
const mockComplete = jest.fn();
jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    objects: {
      create: mockCreate,
      complete: mockComplete,
    },
  }),
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
}));

// Mock fetch for upload
const mockFetch = jest.fn<typeof globalThis.fetch>();
globalThis.fetch = mockFetch;

describe("createTarBuffer", () => {
  let testDir: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    testDir = await mkdtemp(join(tmpdir(), "rl-upload-test-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("creates a valid tar buffer from multiple files", async () => {
    await writeFile(join(testDir, "a.txt"), "hello");
    await writeFile(join(testDir, "b.txt"), "world");

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer(
      [join(testDir, "a.txt"), join(testDir, "b.txt")],
      false,
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const entries = parseTar(buffer);
    const names = entries.map((e) => e.name);
    expect(names).toHaveLength(2);
    expect(names.some((n) => n.endsWith("a.txt"))).toBe(true);
    expect(names.some((n) => n.endsWith("b.txt"))).toBe(true);
  });

  it("creates a valid tgz buffer (gzipped)", async () => {
    await writeFile(join(testDir, "file.txt"), "compressed content");

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer(
      [join(testDir, "file.txt")],
      true,
    );

    expect(buffer).toBeInstanceOf(Buffer);
    // Gzip magic bytes: 0x1f 0x8b
    expect(buffer[0]).toBe(0x1f);
    expect(buffer[1]).toBe(0x8b);
  });

  it("creates a tar from a directory", async () => {
    const subDir = join(testDir, "mydir");
    await mkdir(subDir);
    await writeFile(join(subDir, "nested.txt"), "nested content");

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([subDir], false);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const entries = parseTar(buffer);
    const dirEntry = entries.find((e) => e.name.endsWith("mydir/"));
    const fileEntry = entries.find((e) => e.name.endsWith("nested.txt"));
    expect(dirEntry).toBeDefined();
    expect(fileEntry).toBeDefined();
  });

  it("normalizes uid/gid to 1000 for all entries", async () => {
    await writeFile(join(testDir, "file.txt"), "content");

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([join(testDir, "file.txt")], false);

    // Verify uid/gid by reading the raw tar header bytes directly.
    // nanotar's parseTar has an octal parsing quirk, so read the raw field.
    const uid = buffer.toString("ascii", 108, 115).replace(/\0/g, "").trim();
    const gid = buffer.toString("ascii", 116, 123).replace(/\0/g, "").trim();
    expect(parseInt(uid, 8)).toBe(1000);
    expect(parseInt(gid, 8)).toBe(1000);
  });

  it("sets mode 644 for non-executable files and 755 for executable files", async () => {
    const normalFile = join(testDir, "normal.txt");
    const execFile = join(testDir, "script.sh");
    await writeFile(normalFile, "data");
    await writeFile(execFile, "#!/bin/sh\necho hi");
    await chmod(execFile, 0o755);

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([normalFile, execFile], false);

    const entries = parseTar(buffer);
    const normal = entries.find((e) => e.name.endsWith("normal.txt"));
    const exec = entries.find((e) => e.name.endsWith("script.sh"));
    expect(normal?.attrs?.mode).toContain("644");
    expect(exec?.attrs?.mode).toContain("755");
  });

  it("sets mode 755 for directories", async () => {
    const subDir = join(testDir, "subdir");
    await mkdir(subDir);
    await writeFile(join(subDir, "file.txt"), "content");

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([subDir], false);

    const entries = parseTar(buffer);
    const dir = entries.find((e) => e.name.endsWith("subdir/"));
    expect(dir?.attrs?.mode).toContain("755");
  });

  it("preserves mtime from the filesystem", async () => {
    const filePath = join(testDir, "dated.txt");
    await writeFile(filePath, "content");
    // Set a known mtime: 2024-01-15T00:00:00Z
    const knownTime = new Date("2024-01-15T00:00:00Z");
    await utimes(filePath, knownTime, knownTime);

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([filePath], false);

    const entries = parseTar(buffer);
    const entry = entries.find((e) => e.name.endsWith("dated.txt"));
    expect(entry?.attrs?.mtime).toBeDefined();
    // parseTar returns mtime in seconds (raw tar format)
    const expectedSec = Math.floor(knownTime.getTime() / 1000);
    expect(entry?.attrs?.mtime).toBe(expectedSec);
  });
});

describe("uploadObject", () => {
  let testDir: string;

  beforeEach(async () => {
    jest.clearAllMocks();
    testDir = await mkdtemp(join(tmpdir(), "rl-upload-test-"));
    mockCreate.mockResolvedValue({
      id: "obj_test123",
      upload_url: "https://example.com/upload",
    });
    mockFetch.mockResolvedValue({ ok: true } as Response);
    mockComplete.mockResolvedValue({});
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("uploads a single file with existing behavior", async () => {
    const filePath = join(testDir, "test.txt");
    await writeFile(filePath, "test content");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { uploadObject } = await import("@/commands/object/upload.js");
    await uploadObject({
      paths: [filePath],
      name: "test-object",
    });

    logSpy.mockRestore();

    expect(mockCreate).toHaveBeenCalledWith({
      name: "test-object",
      content_type: "text",
    });
    expect(mockFetch).toHaveBeenCalled();
    expect(mockComplete).toHaveBeenCalledWith("obj_test123");
  });

  it("errors when multiple paths given without tar/tgz content type", async () => {
    const file1 = join(testDir, "a.txt");
    const file2 = join(testDir, "b.txt");
    await writeFile(file1, "a");
    await writeFile(file2, "b");

    const { uploadObject } = await import("@/commands/object/upload.js");
    await uploadObject({
      paths: [file1, file2],
      name: "test-object",
      contentType: "text",
    });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Multiple paths require --content-type tar or --content-type tgz",
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("errors when directory given without tar/tgz content type", async () => {
    const dir = join(testDir, "mydir");
    await mkdir(dir);

    const { uploadObject } = await import("@/commands/object/upload.js");
    await uploadObject({
      paths: [dir],
      name: "test-object",
    });

    expect(mockOutputError).toHaveBeenCalledWith(
      "Cannot upload a directory directly. Use --content-type tar or --content-type tgz to create an archive.",
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("errors when path does not exist", async () => {
    const { uploadObject } = await import("@/commands/object/upload.js");
    await uploadObject({
      paths: [join(testDir, "nonexistent.txt")],
      name: "test-object",
    });

    expect(mockOutputError).toHaveBeenCalledWith(
      expect.stringContaining("Path does not exist"),
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates tar archive from multiple files when content type is tar", async () => {
    const file1 = join(testDir, "a.txt");
    const file2 = join(testDir, "b.txt");
    await writeFile(file1, "file a");
    await writeFile(file2, "file b");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { uploadObject } = await import("@/commands/object/upload.js");
    await uploadObject({
      paths: [file1, file2],
      name: "multi-file-archive",
      contentType: "tar",
    });

    logSpy.mockRestore();

    expect(mockCreate).toHaveBeenCalledWith({
      name: "multi-file-archive",
      content_type: "tar",
    });
    expect(mockFetch).toHaveBeenCalled();
    expect(mockComplete).toHaveBeenCalledWith("obj_test123");
  });

  it("creates tgz archive from a directory when content type is tgz", async () => {
    const dir = join(testDir, "mydir");
    await mkdir(dir);
    await writeFile(join(dir, "file.txt"), "content");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { uploadObject } = await import("@/commands/object/upload.js");
    await uploadObject({
      paths: [dir],
      name: "dir-archive",
      contentType: "tgz",
    });

    logSpy.mockRestore();

    expect(mockCreate).toHaveBeenCalledWith({
      name: "dir-archive",
      content_type: "tgz",
    });
    expect(mockFetch).toHaveBeenCalled();
  });

  it("uploads single tar file as-is without creating archive", async () => {
    const filePath = join(testDir, "existing.tar");
    await writeFile(filePath, "fake tar content");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { uploadObject } = await import("@/commands/object/upload.js");
    await uploadObject({
      paths: [filePath],
      name: "existing-archive",
      contentType: "tar",
    });

    logSpy.mockRestore();

    expect(mockCreate).toHaveBeenCalledWith({
      name: "existing-archive",
      content_type: "tar",
    });
    // Should upload the raw file content, not create a tar of the tar
    const fetchCall = mockFetch.mock.calls[0];
    const body = fetchCall[1]?.body as Buffer;
    expect(body.toString()).toBe("fake tar content");
  });
});

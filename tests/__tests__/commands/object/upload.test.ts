/**
 * Tests for object upload command - tar/tgz archive creation and validation
 */

import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, writeFile, mkdir, rm, chmod, utimes, symlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";
import { createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import tar from "tar-stream";
import type { Headers } from "tar-stream";

interface ExtractedEntry {
  header: Headers;
  data: Buffer;
}

async function extractTar(buffer: Buffer): Promise<ExtractedEntry[]> {
  const extract = tar.extract();
  const entries: ExtractedEntry[] = [];
  const done = new Promise<void>((resolve, reject) => {
    extract.on("entry", (header, stream, next) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        entries.push({ header, data: Buffer.concat(chunks) });
        next();
      });
      stream.resume();
    });
    extract.on("finish", resolve);
    extract.on("error", reject);
  });
  Readable.from(buffer).pipe(extract);
  await done;
  return entries;
}

async function extractTgz(buffer: Buffer): Promise<ExtractedEntry[]> {
  const gunzip = createGunzip();
  const extract = tar.extract();
  const entries: ExtractedEntry[] = [];
  const done = new Promise<void>((resolve, reject) => {
    extract.on("entry", (header, stream, next) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        entries.push({ header, data: Buffer.concat(chunks) });
        next();
      });
      stream.resume();
    });
    extract.on("finish", resolve);
    extract.on("error", reject);
  });
  await pipeline(Readable.from(buffer), gunzip, extract);
  await done;
  return entries;
}

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

    const entries = await extractTar(buffer);
    const names = entries.map((e) => e.header.name);
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
    expect(buffer[0]).toBe(0x1f);
    expect(buffer[1]).toBe(0x8b);

    const entries = await extractTgz(buffer);
    expect(entries).toHaveLength(1);
    expect(entries[0].data.toString()).toBe("compressed content");
  });

  it("creates a tar from a directory", async () => {
    const subDir = join(testDir, "mydir");
    await mkdir(subDir);
    await writeFile(join(subDir, "nested.txt"), "nested content");

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([subDir], false);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const entries = await extractTar(buffer);
    const dirEntry = entries.find((e) => e.header.name.endsWith("mydir/"));
    const fileEntry = entries.find((e) => e.header.name.endsWith("nested.txt"));
    expect(dirEntry).toBeDefined();
    expect(dirEntry!.header.type).toBe("directory");
    expect(fileEntry).toBeDefined();
  });

  it("normalizes uid/gid to 1000 for all entries", async () => {
    await writeFile(join(testDir, "file.txt"), "content");

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([join(testDir, "file.txt")], false);

    const entries = await extractTar(buffer);
    expect(entries[0].header.uid).toBe(1000);
    expect(entries[0].header.gid).toBe(1000);
  });

  it("sets mode 644 for non-executable files and 755 for executable files", async () => {
    const normalFile = join(testDir, "normal.txt");
    const execFile = join(testDir, "script.sh");
    await writeFile(normalFile, "data");
    await writeFile(execFile, "#!/bin/sh\necho hi");
    await chmod(execFile, 0o755);

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([normalFile, execFile], false);

    const entries = await extractTar(buffer);
    const normal = entries.find((e) => e.header.name.endsWith("normal.txt"));
    const exec = entries.find((e) => e.header.name.endsWith("script.sh"));
    expect(normal!.header.mode).toBe(0o644);
    expect(exec!.header.mode).toBe(0o755);
  });

  it("sets mode 755 for directories", async () => {
    const subDir = join(testDir, "subdir");
    await mkdir(subDir);
    await writeFile(join(subDir, "file.txt"), "content");

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([subDir], false);

    const entries = await extractTar(buffer);
    const dir = entries.find((e) => e.header.name.endsWith("subdir/"));
    expect(dir!.header.mode).toBe(0o755);
  });

  it("stores symlinks as symlink entries with correct linkname", async () => {
    const realFile = join(testDir, "real.txt");
    const linkFile = join(testDir, "link.txt");
    await writeFile(realFile, "real content");
    await symlink(realFile, linkFile);

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([realFile, linkFile], false);

    const entries = await extractTar(buffer);
    expect(entries).toHaveLength(2);
    const realEntry = entries.find((e) => e.header.name.endsWith("real.txt"));
    const linkEntry = entries.find((e) => e.header.name.endsWith("link.txt"));
    expect(realEntry).toBeDefined();
    expect(realEntry!.header.type).toBe("file");
    expect(realEntry!.data.toString()).toBe("real content");
    expect(linkEntry).toBeDefined();
    expect(linkEntry!.header.type).toBe("symlink");
    expect(linkEntry!.header.linkname).toBe(realFile);
  });

  it("stores symlinks inside a directory tree", async () => {
    const subDir = join(testDir, "with-symlink");
    await mkdir(subDir);
    await writeFile(join(subDir, "real.txt"), "real content");
    await symlink(join(subDir, "real.txt"), join(subDir, "link.txt"));

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([subDir], false);

    const entries = await extractTar(buffer);
    const names = entries.map((e) => e.header.name);
    expect(names.some((n) => n.endsWith("real.txt"))).toBe(true);
    expect(names.some((n) => n.endsWith("link.txt"))).toBe(true);
    const linkEntry = entries.find((e) => e.header.name.endsWith("link.txt"));
    expect(linkEntry!.header.type).toBe("symlink");
  });

  it("rejects duplicate paths", async () => {
    const filePath = join(testDir, "dup.txt");
    await writeFile(filePath, "content");

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    await expect(
      createTarBuffer([filePath, filePath], false),
    ).rejects.toThrow(/Duplicate paths/);
  });

  it("preserves mtime from the filesystem", async () => {
    const filePath = join(testDir, "dated.txt");
    await writeFile(filePath, "content");
    const knownTime = new Date("2024-01-15T00:00:00Z");
    await utimes(filePath, knownTime, knownTime);

    const { createTarBuffer } = await import("@/commands/object/upload.js");
    const buffer = await createTarBuffer([filePath], false);

    const entries = await extractTar(buffer);
    const entry = entries.find((e) => e.header.name.endsWith("dated.txt"));
    expect(entry!.header.mtime).toBeDefined();
    expect(entry!.header.mtime!.getTime()).toBe(knownTime.getTime());
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
    const fetchCall = mockFetch.mock.calls[0];
    const body = fetchCall[1]?.body as Buffer;
    expect(body.toString()).toBe("fake tar content");
  });
});

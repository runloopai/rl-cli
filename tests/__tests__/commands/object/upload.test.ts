/**
 * Tests for object upload command - tar/tgz archive creation and validation
 */

import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import * as tar from "tar";

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

    // Verify the tar contains the expected files
    const entries: string[] = [];
    const extractDir = await mkdtemp(join(tmpdir(), "rl-extract-test-"));
    await tar.extract({ file: undefined, cwd: extractDir, sync: false }, undefined);

    // Write buffer to temp file and list contents
    const tmpFile = join(testDir, "test.tar");
    await writeFile(tmpFile, buffer);
    await tar.list({
      file: tmpFile,
      onReadEntry: (entry) => {
        entries.push(entry.path);
      },
    });

    expect(entries.length).toBe(2);
    await rm(extractDir, { recursive: true, force: true });
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

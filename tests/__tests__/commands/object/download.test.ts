import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockRetrieve = jest.fn();
const mockDownload = jest.fn();
jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    objects: {
      retrieve: mockRetrieve,
      download: mockDownload,
    },
  }),
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
}));

const mockWriteFile = jest.fn();
jest.unstable_mockModule("fs/promises", () => ({
  writeFile: mockWriteFile,
}));

const mockStdoutWrite = jest.fn(() => true);
const mockStderrWrite = jest.fn(() => true);
const mockProcessUtils = {
  stdout: {
    write: mockStdoutWrite,
    isTTY: false,
  },
  stderr: {
    write: mockStderrWrite,
    isTTY: false,
  },
};
jest.unstable_mockModule("@/utils/processUtils.js", () => ({
  processUtils: mockProcessUtils,
}));

const mockFetch = jest.fn<typeof globalThis.fetch>();
globalThis.fetch = mockFetch;

const TEST_BUFFER = Buffer.from("file content bytes");

describe("downloadObject", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessUtils.stdout.isTTY = false;

    mockDownload.mockResolvedValue({
      download_url: "https://example.com/download",
    });
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => TEST_BUFFER.buffer.slice(
        TEST_BUFFER.byteOffset,
        TEST_BUFFER.byteOffset + TEST_BUFFER.byteLength,
      ),
    } as Response);
    mockWriteFile.mockResolvedValue(undefined);
  });

  it("downloads to specified file path", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { downloadObject } = await import("@/commands/object/download.js");
    await downloadObject({
      id: "obj_123",
      path: "/tmp/output.bin",
    });

    expect(mockWriteFile).toHaveBeenCalledWith(
      "/tmp/output.bin",
      expect.any(Buffer),
    );
    const writtenBuffer = mockWriteFile.mock.calls[0][1] as Buffer;
    expect(writtenBuffer.toString()).toBe("file content bytes");
    expect(logSpy).toHaveBeenCalledWith("/tmp/output.bin");
    expect(mockStdoutWrite).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("auto-resolves path from object name when no path provided", async () => {
    mockRetrieve.mockResolvedValue({
      id: "obj_123",
      name: "myfile",
      content_type: "text",
    });
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const { downloadObject } = await import("@/commands/object/download.js");
    await downloadObject({
      id: "obj_123",
    });

    expect(mockRetrieve).toHaveBeenCalledWith("obj_123");
    expect(mockWriteFile).toHaveBeenCalledWith(
      "./myfile.txt",
      expect.any(Buffer),
    );
    expect(logSpy).toHaveBeenCalledWith("./myfile.txt");
    logSpy.mockRestore();
  });

  it("writes to stdout when path is -", async () => {
    mockRetrieve.mockResolvedValue({
      id: "obj_123",
      name: "myfile",
      content_type: "text",
    });

    const { downloadObject } = await import("@/commands/object/download.js");
    await downloadObject({
      id: "obj_123",
      path: "-",
    });

    expect(mockStdoutWrite).toHaveBeenCalledWith(expect.any(Buffer));
    const writtenBuffer = mockStdoutWrite.mock.calls[0][0] as Buffer;
    expect(writtenBuffer.toString()).toBe("file content bytes");
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("warns about binary content when writing to stdout on TTY", async () => {
    mockProcessUtils.stdout.isTTY = true;
    mockRetrieve.mockResolvedValue({
      id: "obj_123",
      name: "myfile",
      content_type: "binary",
    });

    const { downloadObject } = await import("@/commands/object/download.js");
    await downloadObject({
      id: "obj_123",
      path: "-",
    });

    expect(mockStderrWrite).toHaveBeenCalledWith(
      expect.stringContaining("binary data"),
    );
  });

  it("does not warn about text content when writing to stdout on TTY", async () => {
    mockProcessUtils.stdout.isTTY = true;
    mockRetrieve.mockResolvedValue({
      id: "obj_123",
      name: "myfile",
      content_type: "text",
    });

    const { downloadObject } = await import("@/commands/object/download.js");
    await downloadObject({
      id: "obj_123",
      path: "-",
    });

    expect(mockStderrWrite).not.toHaveBeenCalledWith(
      expect.stringContaining("binary data"),
    );
  });

  it("outputs structured JSON to stderr in stdout mode", async () => {
    mockRetrieve.mockResolvedValue({
      id: "obj_123",
      name: "myfile",
      content_type: "text",
    });

    const { downloadObject } = await import("@/commands/object/download.js");
    await downloadObject({
      id: "obj_123",
      path: "-",
      output: "json",
    });

    const stderrCall = mockStderrWrite.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes('"id"'),
    );
    expect(stderrCall).toBeDefined();
    const parsed = JSON.parse(stderrCall![0] as string);
    expect(parsed).toEqual({
      id: "obj_123",
      path: "-",
      extracted: false,
    });
  });

  it("does not output structured result for text mode in stdout mode", async () => {
    mockRetrieve.mockResolvedValue({
      id: "obj_123",
      name: "myfile",
      content_type: "text",
    });

    const { downloadObject } = await import("@/commands/object/download.js");
    await downloadObject({
      id: "obj_123",
      path: "-",
    });

    const jsonCall = mockStderrWrite.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes('"id"'),
    );
    expect(jsonCall).toBeUndefined();
  });
});

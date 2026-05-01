import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

const mockObjectsCreate = jest.fn();
const mockObjectsComplete = jest.fn();

jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    objects: {
      create: mockObjectsCreate,
      complete: mockObjectsComplete,
      list: jest.fn(),
      retrieve: jest.fn(),
      download: jest.fn(),
      upload: jest.fn(),
      delete: jest.fn(),
    },
  }),
}));

const { createObject, completeObject, uploadToPresignedUrl } = await import(
  "@/services/objectService.js"
);

describe("createObject", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates object with required params", async () => {
    mockObjectsCreate.mockResolvedValue({
      id: "obj_new",
      name: "test.bin",
      upload_url: "https://s3.example.com/upload",
    });

    const result = await createObject({
      name: "test.bin",
      content_type: "binary",
    });

    expect(result.id).toBe("obj_new");
    expect(result.upload_url).toBe("https://s3.example.com/upload");
    expect(mockObjectsCreate).toHaveBeenCalledWith({
      name: "test.bin",
      content_type: "binary",
      metadata: undefined,
      ttl_ms: undefined,
    });
  });

  it("passes optional metadata and ttl_ms", async () => {
    mockObjectsCreate.mockResolvedValue({
      id: "obj_new",
      name: "test.bin",
      upload_url: "https://s3.example.com/upload",
    });

    await createObject({
      name: "test.bin",
      content_type: "text",
      metadata: { env: "test" },
      ttl_ms: 3600000,
    });

    expect(mockObjectsCreate).toHaveBeenCalledWith({
      name: "test.bin",
      content_type: "text",
      metadata: { env: "test" },
      ttl_ms: 3600000,
    });
  });

  it("throws when API does not return upload_url", async () => {
    mockObjectsCreate.mockResolvedValue({
      id: "obj_new",
      name: "test.bin",
    });

    await expect(
      createObject({ name: "test.bin", content_type: "binary" }),
    ).rejects.toThrow("API did not return an upload URL");
  });
});

describe("completeObject", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls client.objects.complete with correct id", async () => {
    mockObjectsComplete.mockResolvedValue(undefined);

    await completeObject("obj_123");

    expect(mockObjectsComplete).toHaveBeenCalledWith("obj_123");
  });
});

describe("uploadToPresignedUrl", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("makes PUT with correct headers", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true } as Response);
    globalThis.fetch = mockFetch as any;

    const buffer = Buffer.from("hello world");
    await uploadToPresignedUrl("https://s3.example.com/upload", buffer);

    expect(mockFetch).toHaveBeenCalledWith("https://s3.example.com/upload", {
      method: "PUT",
      body: buffer,
      headers: { "Content-Length": "11" },
    });
  });

  it("throws on non-ok response", async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 403 } as Response);
    globalThis.fetch = mockFetch as any;

    await expect(
      uploadToPresignedUrl(
        "https://s3.example.com/upload",
        Buffer.from("data"),
      ),
    ).rejects.toThrow("Upload failed: HTTP 403");
  });
});

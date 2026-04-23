import {
  formatFileSize,
  buildObjectDetailFields,
} from "../../../src/services/objectService.js";
import type { StorageObjectView } from "../../../src/store/objectStore.js";

describe("formatFileSize", () => {
  it("returns Unknown for null", () => {
    expect(formatFileSize(null)).toBe("Unknown");
  });

  it("returns Unknown for undefined", () => {
    expect(formatFileSize(undefined)).toBe("Unknown");
  });

  it("formats bytes", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.00 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.00 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.00 GB");
  });

  it("formats zero bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });
});

describe("buildObjectDetailFields", () => {
  const baseObject: StorageObjectView = {
    id: "obj_123",
    name: "test.txt",
    content_type: "text/plain",
    create_time_ms: 1700000000000,
    state: "READY",
    size_bytes: 1024,
  };

  it("includes content type", () => {
    const fields = buildObjectDetailFields(baseObject);
    expect(fields.find((f) => f.label === "Content Type")?.value).toBe(
      "text/plain",
    );
  });

  it("includes formatted size", () => {
    const fields = buildObjectDetailFields(baseObject);
    expect(fields.find((f) => f.label === "Size")?.value).toBe("1.00 KB");
  });

  it("includes state", () => {
    const fields = buildObjectDetailFields(baseObject);
    expect(fields.find((f) => f.label === "State")?.value).toBe("READY");
  });

  it("includes public field when set", () => {
    const fields = buildObjectDetailFields({ ...baseObject, is_public: true });
    expect(fields.find((f) => f.label === "Public")?.value).toBe("Yes");
  });

  it("includes created timestamp", () => {
    const fields = buildObjectDetailFields(baseObject);
    expect(fields.find((f) => f.label === "Created")).toBeDefined();
  });

  it("includes expires when delete_after_time_ms is set", () => {
    const future = Date.now() + 3600000; // 1 hour from now
    const fields = buildObjectDetailFields({
      ...baseObject,
      delete_after_time_ms: future,
    });
    const expiresField = fields.find((f) => f.label === "Expires");
    expect(expiresField).toBeDefined();
    expect(expiresField?.value).toContain("remaining");
  });

  it("shows Expired with error color for past delete_after_time_ms", () => {
    const past = Date.now() - 1000;
    const fields = buildObjectDetailFields({
      ...baseObject,
      delete_after_time_ms: past,
    });
    const expiresField = fields.find((f) => f.label === "Expires");
    expect(expiresField?.value).toBe("Expired");
    expect(expiresField?.color).toBe("error");
  });

  it("shows warning color when expiry is under 10 minutes", () => {
    const soon = Date.now() + 5 * 60000; // 5 minutes from now
    const fields = buildObjectDetailFields({
      ...baseObject,
      delete_after_time_ms: soon,
    });
    const expiresField = fields.find((f) => f.label === "Expires");
    expect(expiresField?.color).toBe("warning");
  });
});

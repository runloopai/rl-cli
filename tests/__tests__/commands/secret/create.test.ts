/**
 * Tests for secret create command
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock dependencies using the path alias
const mockCreate = jest.fn();
jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    secrets: {
      create: mockCreate,
    },
  }),
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
}));

const mockGetSecretValue = jest.fn();
jest.unstable_mockModule("@/utils/stdin.js", () => ({
  getSecretValue: mockGetSecretValue,
}));

describe("createSecret", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (console.log as jest.Mock).mockClear();
    // Reset mock implementations to default (no-op)
    mockOutputError.mockReset();
    mockOutput.mockReset();
    mockGetSecretValue.mockReset();
    mockCreate.mockReset();
  });

  it("should create a secret with value from stdin/prompt", async () => {
    const mockSecret = { id: "secret-123", name: "my-secret" };
    mockGetSecretValue.mockResolvedValue("super-secret-value");
    mockCreate.mockResolvedValue(mockSecret);

    const { createSecret } = await import("@/commands/secret/create.js");
    await createSecret("my-secret", {});

    expect(mockGetSecretValue).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith({
      name: "my-secret",
      value: "super-secret-value",
    });
    expect(console.log).toHaveBeenCalledWith("secret-123");
  });

  it("should output error for empty secret value", async () => {
    mockGetSecretValue.mockResolvedValue("");
    // Make outputError throw to simulate process.exit behavior in tests
    mockOutputError.mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const { createSecret } = await import("@/commands/secret/create.js");

    await expect(createSecret("my-secret", {})).rejects.toThrow(
      "process.exit called",
    );

    expect(mockOutputError).toHaveBeenCalledWith(
      "Secret value cannot be empty",
      expect.any(Error),
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should output JSON format when requested", async () => {
    const mockSecret = { id: "secret-456", name: "json-secret" };
    mockGetSecretValue.mockResolvedValue("json-value");
    mockCreate.mockResolvedValue(mockSecret);

    const { createSecret } = await import("@/commands/secret/create.js");
    await createSecret("json-secret", { output: "json" });

    expect(mockOutput).toHaveBeenCalledWith(mockSecret, {
      format: "json",
      defaultFormat: "json",
    });
    expect(console.log).not.toHaveBeenCalledWith("secret-456");
  });

  it("should output YAML format when requested", async () => {
    const mockSecret = { id: "secret-789", name: "yaml-secret" };
    mockGetSecretValue.mockResolvedValue("yaml-value");
    mockCreate.mockResolvedValue(mockSecret);

    const { createSecret } = await import("@/commands/secret/create.js");
    await createSecret("yaml-secret", { output: "yaml" });

    expect(mockOutput).toHaveBeenCalledWith(mockSecret, {
      format: "yaml",
      defaultFormat: "json",
    });
  });

  it("should output just the ID in text format (default)", async () => {
    const mockSecret = { id: "secret-text", name: "text-secret" };
    mockGetSecretValue.mockResolvedValue("text-value");
    mockCreate.mockResolvedValue(mockSecret);

    const { createSecret } = await import("@/commands/secret/create.js");
    await createSecret("text-secret", { output: "text" });

    expect(console.log).toHaveBeenCalledWith("secret-text");
    expect(mockOutput).not.toHaveBeenCalled();
  });

  it("should handle API errors gracefully", async () => {
    const apiError = new Error("API Error: Unauthorized");
    mockGetSecretValue.mockResolvedValue("some-value");
    mockCreate.mockRejectedValue(apiError);

    const { createSecret } = await import("@/commands/secret/create.js");
    await createSecret("error-secret", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to create secret",
      apiError,
    );
  });

  it("should work with piped input (simulated by non-TTY stdin)", async () => {
    // This simulates: echo "piped-secret" | rli secret create my-piped-secret
    const mockSecret = { id: "piped-id", name: "my-piped-secret" };
    mockGetSecretValue.mockResolvedValue("piped-secret");
    mockCreate.mockResolvedValue(mockSecret);

    const { createSecret } = await import("@/commands/secret/create.js");
    await createSecret("my-piped-secret", {});

    expect(mockGetSecretValue).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith({
      name: "my-piped-secret",
      value: "piped-secret",
    });
    expect(console.log).toHaveBeenCalledWith("piped-id");
  });
});

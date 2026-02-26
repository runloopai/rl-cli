/**
 * Tests for MCP config validation utility
 */
import { describe, it, expect } from "@jest/globals";
import {
  validateMcpConfig,
  type McpConfigValidationInput,
} from "../../../src/utils/mcpConfigValidation.js";

describe("validateMcpConfig", () => {
  const validInput: McpConfigValidationInput = {
    name: "test-config",
    endpoint: "https://mcp.example.com",
    allowedTools: "github.search_*, github.get_*",
  };

  const allRequired = {
    requireName: true,
    requireEndpoint: true,
    requireAllowedTools: true,
  };

  describe("valid inputs", () => {
    it("accepts valid name, endpoint, and allowed tools", () => {
      const result = validateMcpConfig(validInput, allRequired);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.sanitized).toBeDefined();
      expect(result.sanitized!.name).toBe("test-config");
      expect(result.sanitized!.endpoint).toBe("https://mcp.example.com");
      expect(result.sanitized!.allowedTools).toEqual([
        "github.search_*",
        "github.get_*",
      ]);
    });

    it("accepts http:// endpoints", () => {
      const result = validateMcpConfig(
        { ...validInput, endpoint: "http://localhost:3000" },
        allRequired,
      );
      expect(result.valid).toBe(true);
      expect(result.sanitized!.endpoint).toBe("http://localhost:3000");
    });

    it("accepts single wildcard tool pattern", () => {
      const result = validateMcpConfig(
        { ...validInput, allowedTools: "*" },
        allRequired,
      );
      expect(result.valid).toBe(true);
      expect(result.sanitized!.allowedTools).toEqual(["*"]);
    });
  });

  describe("required field enforcement", () => {
    it("requires name when requireName is true", () => {
      const result = validateMcpConfig(
        { ...validInput, name: "" },
        allRequired,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Name is required");
    });

    it("requires endpoint when requireEndpoint is true", () => {
      const result = validateMcpConfig(
        { ...validInput, endpoint: "" },
        allRequired,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Endpoint URL is required");
    });

    it("requires allowed tools when requireAllowedTools is true", () => {
      const result = validateMcpConfig(
        { ...validInput, allowedTools: "" },
        allRequired,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "At least one allowed tool pattern is required (e.g., '*' for all tools)",
      );
    });
  });

  describe("optional fields", () => {
    it("accepts missing name when not required", () => {
      const result = validateMcpConfig(
        { endpoint: "https://mcp.example.com", allowedTools: "*" },
        { requireName: false, requireEndpoint: true, requireAllowedTools: true },
      );
      expect(result.valid).toBe(true);
      expect(result.sanitized!.name).toBeUndefined();
    });

    it("accepts missing endpoint when not required", () => {
      const result = validateMcpConfig(
        { name: "test", allowedTools: "*" },
        { requireName: true, requireEndpoint: false, requireAllowedTools: true },
      );
      expect(result.valid).toBe(true);
      expect(result.sanitized!.endpoint).toBeUndefined();
    });

    it("accepts missing allowed tools when not required", () => {
      const result = validateMcpConfig(
        { name: "test", endpoint: "https://mcp.example.com" },
        {
          requireName: true,
          requireEndpoint: true,
          requireAllowedTools: false,
        },
      );
      expect(result.valid).toBe(true);
      expect(result.sanitized!.allowedTools).toBeUndefined();
    });

    it("defaults all options to not required when opts omitted", () => {
      const result = validateMcpConfig({});
      expect(result.valid).toBe(true);
    });
  });

  describe("endpoint validation", () => {
    it("rejects endpoint without protocol", () => {
      const result = validateMcpConfig(
        { ...validInput, endpoint: "mcp.example.com" },
        allRequired,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("https:// or http://"),
        ]),
      );
    });

    it("rejects invalid URL", () => {
      const result = validateMcpConfig(
        { ...validInput, endpoint: "http://" },
        allRequired,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("allowed tools parsing", () => {
    it("splits comma-separated tools", () => {
      const result = validateMcpConfig(
        { ...validInput, allowedTools: "a,b,c" },
        allRequired,
      );
      expect(result.sanitized!.allowedTools).toEqual(["a", "b", "c"]);
    });

    it("trims whitespace from each tool", () => {
      const result = validateMcpConfig(
        { ...validInput, allowedTools: " a , b , c " },
        allRequired,
      );
      expect(result.sanitized!.allowedTools).toEqual(["a", "b", "c"]);
    });

    it("filters out empty entries from trailing commas", () => {
      const result = validateMcpConfig(
        { ...validInput, allowedTools: "a,,b," },
        allRequired,
      );
      expect(result.sanitized!.allowedTools).toEqual(["a", "b"]);
    });
  });

  describe("whitespace trimming", () => {
    it("trims name", () => {
      const result = validateMcpConfig(
        { ...validInput, name: "  my-config  " },
        allRequired,
      );
      expect(result.sanitized!.name).toBe("my-config");
    });

    it("trims endpoint", () => {
      const result = validateMcpConfig(
        { ...validInput, endpoint: "  https://mcp.example.com  " },
        allRequired,
      );
      expect(result.sanitized!.endpoint).toBe("https://mcp.example.com");
    });
  });

  describe("multiple errors", () => {
    it("returns all validation errors at once", () => {
      const result = validateMcpConfig(
        { name: "", endpoint: "bad-url", allowedTools: "" },
        allRequired,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("edge cases", () => {
    it("handles undefined input fields", () => {
      const result = validateMcpConfig(
        { name: undefined, endpoint: undefined, allowedTools: undefined },
        allRequired,
      );
      expect(result.valid).toBe(false);
    });

    it("handles whitespace-only name as empty", () => {
      const result = validateMcpConfig(
        { ...validInput, name: "   " },
        allRequired,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Name is required");
    });

    it("handles whitespace-only allowed tools as empty", () => {
      const result = validateMcpConfig(
        { ...validInput, allowedTools: "  , , " },
        allRequired,
      );
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "At least one allowed tool pattern is required (e.g., '*' for all tools)",
      );
    });
  });
});

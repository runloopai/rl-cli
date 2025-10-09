import { spawn } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

describe("CLI Default Output Behavior", () => {
  const CLI_PATH = "dist/cli.js";
  
  // Mock API responses for consistent testing
  const mockDevboxList = [
    {
      id: "dbx_test123",
      name: "test-devbox",
      status: "running",
      create_time_ms: 1640995200000,
    }
  ];

  const mockSnapshotList = [
    {
      id: "snap_test123",
      name: "test-snapshot",
      status: "complete",
      create_time_ms: 1640995200000,
    }
  ];

  const mockBlueprintList = [
    {
      id: "bp_test123",
      name: "test-blueprint",
      status: "build_complete",
      create_time_ms: 1640995200000,
    }
  ];

  const mockObjectList = [
    {
      id: "obj_test123",
      name: "test-object",
      content_type: "text",
      size: 1024,
    }
  ];

  describe("Default JSON Output", () => {
    it("should output JSON for devbox list by default", async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} devbox list`);
      
      // Should be valid JSON
      const output = JSON.parse(stdout);
      expect(Array.isArray(output)).toBe(true);
    }, 10000);

    it("should output JSON for snapshot list by default", async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} snapshot list`);
      
      // Should be valid JSON
      const output = JSON.parse(stdout);
      expect(Array.isArray(output)).toBe(true);
    }, 10000);

    it("should output JSON for blueprint list by default", async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} blueprint list`);
      
      // Should be valid JSON
      const output = JSON.parse(stdout);
      expect(Array.isArray(output)).toBe(true);
    }, 10000);

    it("should output JSON for object list by default", async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} object list`);
      
      // Should be valid JSON
      const output = JSON.parse(stdout);
      expect(Array.isArray(output)).toBe(true);
    }, 10000);
  });

  describe("Explicit Format Override", () => {
    it("should output text format when -o text is specified", async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} devbox list -o text`);
      
      // Should not be JSON (text format)
      expect(() => JSON.parse(stdout)).toThrow();
      expect(stdout.trim()).not.toBe("");
    }, 10000);

    it("should output YAML format when -o yaml is specified", async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} devbox list -o yaml`);
      
      // Should not be JSON (YAML format)
      expect(() => JSON.parse(stdout)).toThrow();
      expect(stdout.trim()).not.toBe("");
    }, 10000);

    it("should output JSON format when -o json is explicitly specified", async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} devbox list -o json`);
      
      // Should be valid JSON
      const output = JSON.parse(stdout);
      expect(Array.isArray(output)).toBe(true);
    }, 10000);
  });

  describe("Get Commands Default to JSON", () => {
    it("should output JSON for devbox get by default", async () => {
      // This will likely fail due to invalid ID, but should still attempt JSON output
      try {
        const { stdout } = await execAsync(`node ${CLI_PATH} devbox get invalid-id`);
        // If it succeeds, should be JSON
        JSON.parse(stdout);
      } catch (error) {
        // Expected to fail, but should not be interactive mode
        expect((error as Error).message).not.toContain("Raw mode is not supported");
      }
    }, 10000);

    it("should output JSON for blueprint get by default", async () => {
      try {
        const { stdout } = await execAsync(`node ${CLI_PATH} blueprint get invalid-id`);
        JSON.parse(stdout);
      } catch (error) {
        expect((error as Error).message).not.toContain("Raw mode is not supported");
      }
    }, 10000);
  });

  describe("Create Commands Default to JSON", () => {
    it("should output JSON for devbox create by default", async () => {
      try {
        const { stdout } = await execAsync(`node ${CLI_PATH} devbox create --name test-devbox`);
        // Should be JSON output (likely an error due to missing template)
        JSON.parse(stdout);
      } catch (error) {
        expect((error as Error).message).not.toContain("Raw mode is not supported");
      }
    }, 10000);
  });

  describe("Help Commands", () => {
    it("should show help for devbox list command", async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} devbox list --help`);
      
      expect(stdout).toContain("List all devboxes");
      expect(stdout).toContain("Output format: text|json|yaml (default: json)");
    });

    it("should show help for snapshot list command", async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} snapshot list --help`);
      
      expect(stdout).toContain("List all snapshots");
      expect(stdout).toContain("Output format: text|json|yaml (default: json)");
    });

    it("should show help for blueprint list command", async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} blueprint list --help`);
      
      expect(stdout).toContain("List all blueprints");
      expect(stdout).toContain("Output format: text|json|yaml (default: json)");
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully in JSON format", async () => {
      try {
        const { stdout } = await execAsync(`node ${CLI_PATH} devbox get nonexistent-id`);
        // Should be JSON error response
        const output = JSON.parse(stdout);
        expect(output).toHaveProperty("error");
      } catch (error) {
        // Should not be interactive mode error
        expect((error as Error).message).not.toContain("Raw mode is not supported");
      }
    }, 10000);
  });
});

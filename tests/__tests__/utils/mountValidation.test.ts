/**
 * Tests for mount validation utilities
 */

import { describe, it, expect } from "@jest/globals";
import {
  normalizePath,
  pathsOverlap,
  extractPipBaseName,
  validateMounts,
} from "@/utils/mountValidation.js";
import type { AgentMountInfo, ObjectMountInfo } from "@/utils/mountValidation.js";

describe("normalizePath", () => {
  it("removes trailing slashes", () => {
    expect(normalizePath("/home/user/")).toBe("/home/user");
  });

  it("removes multiple trailing slashes", () => {
    expect(normalizePath("/home/user///")).toBe("/home/user");
  });

  it("preserves root path", () => {
    expect(normalizePath("/")).toBe("/");
  });

  it("returns path unchanged when no trailing slash", () => {
    expect(normalizePath("/home/user")).toBe("/home/user");
  });
});

describe("pathsOverlap", () => {
  it("returns true for identical paths", () => {
    expect(pathsOverlap("/home/user", "/home/user")).toBe(true);
  });

  it("returns true when one is a prefix of the other", () => {
    expect(pathsOverlap("/home/user", "/home/user/sub")).toBe(true);
    expect(pathsOverlap("/home/user/sub", "/home/user")).toBe(true);
  });

  it("returns false for non-overlapping paths", () => {
    expect(pathsOverlap("/home/user", "/home/user2")).toBe(false);
  });

  it("returns false for sibling paths", () => {
    expect(pathsOverlap("/home/alice", "/home/bob")).toBe(false);
  });

  it("handles trailing slashes", () => {
    expect(pathsOverlap("/home/user/", "/home/user")).toBe(true);
  });
});

describe("extractPipBaseName", () => {
  it("strips extras from package name", () => {
    expect(extractPipBaseName("pkg[extra]")).toBe("pkg");
  });

  it("strips multiple extras", () => {
    expect(extractPipBaseName("pkg[extra1,extra2]")).toBe("pkg");
  });

  it("returns name unchanged when no extras", () => {
    expect(extractPipBaseName("pkg")).toBe("pkg");
  });
});

describe("validateMounts", () => {
  it("detects duplicate agent IDs", () => {
    const agents: AgentMountInfo[] = [
      { agent_id: "a1", agent_name: "name1" },
      { agent_id: "a1", agent_name: "name2" },
    ];
    const errors = validateMounts(agents, []);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("duplicate_agent_id");
  });

  it("detects duplicate agent names (case-insensitive)", () => {
    const agents: AgentMountInfo[] = [
      { agent_id: "a1", agent_name: "MyAgent" },
      { agent_id: "a2", agent_name: "myagent" },
    ];
    const errors = validateMounts(agents, []);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("duplicate_agent_name");
  });

  it("detects overlapping paths between agents and object mounts", () => {
    const agents: AgentMountInfo[] = [
      { agent_id: "a1", agent_name: "n1", agent_path: "/home/user", source_type: "git" },
    ];
    const objects: ObjectMountInfo[] = [
      { object_id: "o1", object_path: "/home/user/sub" },
    ];
    const errors = validateMounts(agents, objects);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("overlapping_paths");
  });

  it("detects duplicate npm packages", () => {
    const agents: AgentMountInfo[] = [
      { agent_id: "a1", agent_name: "n1", source_type: "npm", package_name: "foo" },
      { agent_id: "a2", agent_name: "n2", source_type: "npm", package_name: "foo" },
    ];
    const errors = validateMounts(agents, []);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("duplicate_package");
  });

  it("detects duplicate pip packages ignoring extras", () => {
    const agents: AgentMountInfo[] = [
      { agent_id: "a1", agent_name: "n1", source_type: "pip", package_name: "pkg[extra1]" },
      { agent_id: "a2", agent_name: "n2", source_type: "pip", package_name: "pkg[extra2]" },
    ];
    const errors = validateMounts(agents, []);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("duplicate_package");
  });

  it("returns empty array for valid mounts", () => {
    const agents: AgentMountInfo[] = [
      { agent_id: "a1", agent_name: "n1", agent_path: "/home/a", source_type: "git" },
      { agent_id: "a2", agent_name: "n2", source_type: "npm", package_name: "foo" },
    ];
    const objects: ObjectMountInfo[] = [
      { object_id: "o1", object_path: "/home/b" },
    ];
    const errors = validateMounts(agents, objects);
    expect(errors).toHaveLength(0);
  });
});

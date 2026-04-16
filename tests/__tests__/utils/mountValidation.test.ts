/**
 * Tests for mount validation utilities
 */

import { describe, it, expect } from "@jest/globals";
import {
  validateMounts,
  wouldAgentConflict,
} from "@/utils/mountValidation.js";
import type { AgentMountInfo } from "@/utils/mountValidation.js";

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

  it("allows agents with same name but different IDs", () => {
    const agents: AgentMountInfo[] = [
      { agent_id: "a1", agent_name: "MyAgent" },
      { agent_id: "a2", agent_name: "myagent" },
    ];
    const errors = validateMounts(agents, []);
    expect(errors).toHaveLength(0);
  });

  it("returns empty array for valid mounts", () => {
    const agents: AgentMountInfo[] = [
      { agent_id: "a1", agent_name: "n1", agent_path: "/home/a", source_type: "git" },
      { agent_id: "a2", agent_name: "n2", source_type: "npm", package_name: "foo" },
    ];
    const errors = validateMounts(agents, []);
    expect(errors).toHaveLength(0);
  });
});

describe("wouldAgentConflict", () => {
  it("returns null for non-conflicting agent", () => {
    const current: AgentMountInfo[] = [
      { agent_id: "a1", agent_name: "n1" },
    ];
    const candidate: AgentMountInfo = { agent_id: "a2", agent_name: "n2" };
    expect(wouldAgentConflict(candidate, current)).toBeNull();
  });

  it("detects duplicate agent ID", () => {
    const current: AgentMountInfo[] = [{ agent_id: "a1", agent_name: "n1" }];
    const candidate: AgentMountInfo = { agent_id: "a1", agent_name: "n2" };
    expect(wouldAgentConflict(candidate, current)).toContain("already selected");
  });

  it("allows agents with same name but different IDs", () => {
    const current: AgentMountInfo[] = [{ agent_id: "a1", agent_name: "MyAgent" }];
    const candidate: AgentMountInfo = { agent_id: "a2", agent_name: "myagent" };
    expect(wouldAgentConflict(candidate, current)).toBeNull();
  });
});

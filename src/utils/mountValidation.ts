/**
 * Mount validation utilities for enforcing constraints across agent and object mounts.
 */

export interface AgentMountInfo {
  agent_id: string;
  agent_name: string;
  agent_path?: string;
  /** Source type: "npm" | "pip" | "git" | "object" */
  source_type?: string;
  /** For npm/pip agents, the package name */
  package_name?: string;
}

export interface ObjectMountInfo {
  object_id: string;
  object_path: string;
}

export interface ValidationError {
  type:
    | "duplicate_agent_id"
    | "duplicate_agent_name"
    | "overlapping_paths"
    | "duplicate_package";
  message: string;
}

/**
 * Check if adding a candidate agent to the current selection would cause conflicts.
 * Returns the conflict reason string, or null if no conflict.
 */
export function wouldAgentConflict(
  candidate: AgentMountInfo,
  currentSelection: AgentMountInfo[],
): string | null {
  // Duplicate ID
  if (currentSelection.some((a) => a.agent_id === candidate.agent_id)) {
    return `This agent is already selected`;
  }

  // Duplicate name
  if (candidate.agent_name) {
    const candidateLower = candidate.agent_name.toLowerCase();
    const conflicting = currentSelection.find(
      (a) => a.agent_name?.toLowerCase() === candidateLower,
    );
    if (conflicting) {
      return `Conflicts with selected agent "${conflicting.agent_name}" (same name)`;
    }
  }

  // Duplicate npm package
  if (candidate.source_type === "npm" && candidate.package_name) {
    const conflicting = currentSelection.find(
      (a) =>
        a.source_type === "npm" && a.package_name === candidate.package_name,
    );
    if (conflicting) {
      return `Conflicts with selected agent "${conflicting.agent_name || conflicting.agent_id}" (same npm package \`${candidate.package_name}\`)`;
    }
  }

  // Duplicate pip package
  if (candidate.source_type === "pip" && candidate.package_name) {
    const base = extractPipBaseName(candidate.package_name);
    const conflicting = currentSelection.find(
      (a) =>
        a.source_type === "pip" &&
        a.package_name &&
        extractPipBaseName(a.package_name) === base,
    );
    if (conflicting) {
      return `Conflicts with selected agent "${conflicting.agent_name || conflicting.agent_id}" (same pip package \`${base}\`)`;
    }
  }

  return null;
}

/** Remove trailing slashes from a path. */
export function normalizePath(path: string): string {
  let normalized = path;
  while (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Check if two paths overlap (one is a prefix of the other).
 * /home/user and /home/user/sub overlap, but /home/user and /home/user2 don't.
 */
export function pathsOverlap(a: string, b: string): boolean {
  const na = normalizePath(a);
  const nb = normalizePath(b);
  if (na === nb) return true;
  return na.startsWith(nb + "/") || nb.startsWith(na + "/");
}

/**
 * Given a list of labeled mount paths, find which ones overlap with each other.
 * Returns a map from label to an array of overlapping labels.
 */
export function findPathOverlaps(
  mounts: Array<{ label: string; path: string }>,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (let i = 0; i < mounts.length; i++) {
    const a = mounts[i];
    if (!a.path) continue;
    for (let j = i + 1; j < mounts.length; j++) {
      const b = mounts[j];
      if (!b.path) continue;
      if (pathsOverlap(a.path, b.path)) {
        if (!result.has(a.label)) result.set(a.label, []);
        result.get(a.label)!.push(b.label);
        if (!result.has(b.label)) result.set(b.label, []);
        result.get(b.label)!.push(a.label);
      }
    }
  }
  return result;
}

/** Strip [extras] suffix from pip package name: "pkg[extra]" → "pkg" */
export function extractPipBaseName(pkg: string): string {
  const bracketIdx = pkg.indexOf("[");
  return bracketIdx >= 0 ? pkg.substring(0, bracketIdx) : pkg;
}

/**
 * Validate a set of agent mounts and object mounts for conflicts.
 * Returns an array of validation errors (empty if valid).
 */
export function validateMounts(
  agents: AgentMountInfo[],
  objectMounts: ObjectMountInfo[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check duplicate agent IDs
  const seenIds = new Set<string>();
  for (const agent of agents) {
    if (agent.agent_id && seenIds.has(agent.agent_id)) {
      errors.push({
        type: "duplicate_agent_id",
        message: `Duplicate agent ID: ${agent.agent_id}`,
      });
    }
    if (agent.agent_id) seenIds.add(agent.agent_id);
  }

  // Check duplicate agent names
  const seenNames = new Set<string>();
  for (const agent of agents) {
    if (agent.agent_name) {
      const lower = agent.agent_name.toLowerCase();
      if (seenNames.has(lower)) {
        errors.push({
          type: "duplicate_agent_name",
          message: `Duplicate agent name: ${agent.agent_name}`,
        });
      }
      seenNames.add(lower);
    }
  }

  // Check duplicate npm packages
  const seenNpmPkgs = new Set<string>();
  for (const agent of agents) {
    if (agent.source_type === "npm" && agent.package_name) {
      if (seenNpmPkgs.has(agent.package_name)) {
        errors.push({
          type: "duplicate_package",
          message: `Duplicate npm package: ${agent.package_name}`,
        });
      }
      seenNpmPkgs.add(agent.package_name);
    }
  }

  // Check duplicate pip packages (strip extras)
  const seenPipPkgs = new Set<string>();
  for (const agent of agents) {
    if (agent.source_type === "pip" && agent.package_name) {
      const base = extractPipBaseName(agent.package_name);
      if (seenPipPkgs.has(base)) {
        errors.push({
          type: "duplicate_package",
          message: `Duplicate pip package: ${base}`,
        });
      }
      seenPipPkgs.add(base);
    }
  }

  // Collect all mount paths (agent paths for git/object agents + object mount paths)
  const allPaths: string[] = [];
  for (const agent of agents) {
    if (
      agent.agent_path &&
      (agent.source_type === "git" ||
        agent.source_type === "object" ||
        !agent.source_type)
    ) {
      allPaths.push(normalizePath(agent.agent_path));
    }
  }
  for (const om of objectMounts) {
    if (om.object_path) {
      allPaths.push(normalizePath(om.object_path));
    }
  }

  // Check for overlapping paths
  for (let i = 0; i < allPaths.length; i++) {
    for (let j = i + 1; j < allPaths.length; j++) {
      if (pathsOverlap(allPaths[i], allPaths[j])) {
        errors.push({
          type: "overlapping_paths",
          message: `Overlapping mount paths: ${allPaths[i]} and ${allPaths[j]}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Mount validation utilities for enforcing constraints across agent and object mounts.
 *
 * Only duplicate agent identity (same agent_id) is checked on the frontend.
 * Other constraints (duplicate names, package conflicts, path overlaps) are
 * enforced by the backend API and errors are propagated to the user.
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
  type: "duplicate_agent_id";
  message: string;
}

/**
 * Check if adding a candidate agent to the current selection would cause conflicts.
 * Only checks for duplicate agent identity (same ID).
 * Returns the conflict reason string, or null if no conflict.
 */
export function wouldAgentConflict(
  candidate: AgentMountInfo,
  currentSelection: AgentMountInfo[],
): string | null {
  if (currentSelection.some((a) => a.agent_id === candidate.agent_id)) {
    return `This agent is already selected`;
  }
  return null;
}

/**
 * Validate a set of agent mounts for conflicts.
 * Only checks for duplicate agent IDs on the frontend.
 * Returns an array of validation errors (empty if valid).
 */
export function validateMounts(
  agents: AgentMountInfo[],
  _objectMounts: ObjectMountInfo[],
): ValidationError[] {
  const errors: ValidationError[] = [];

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

  return errors;
}

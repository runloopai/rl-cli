/**
 * Mount path utilities shared between CLI and TUI devbox creation.
 */
import type { Agent } from "../services/agentService.js";

export const DEFAULT_MOUNT_PATH = "/home/user";

export function sanitizeMountSegment(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function adjustFileExtension(
  name: string,
  contentType?: string,
): string {
  const archiveExts = /\.(tar\.gz|tar\.bz2|tar\.xz|tgz|gz|bz2|xz|zip|tar)$/i;
  const stripped = name.replace(archiveExts, "");
  if (stripped !== name) return stripped;
  if (contentType && /tar|gzip|x-compressed/i.test(contentType)) {
    const dotIdx = name.lastIndexOf(".");
    if (dotIdx > 0) return name.substring(0, dotIdx);
  }
  return name;
}

export function repoBasename(repo: string): string | undefined {
  const cleaned = repo
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  const m = cleaned.match(/(?:[/:])([^/:\s]+?)(?:\.git)?$/);
  return m?.[1];
}

export function getDefaultAgentMountPath(agent: Agent): string {
  const source = agent.source;
  if (source?.git?.repository) {
    const base = repoBasename(source.git.repository);
    if (base) {
      const s = sanitizeMountSegment(base);
      if (s) return `${DEFAULT_MOUNT_PATH}/${s}`;
    }
  }
  if (agent.name) {
    const s = sanitizeMountSegment(agent.name);
    if (s) return `${DEFAULT_MOUNT_PATH}/${s}`;
  }
  return `${DEFAULT_MOUNT_PATH}/agent`;
}

export function getDefaultObjectMountPath(obj: {
  id: string;
  name?: string;
  content_type?: string;
}): string {
  if (obj.name) {
    const adjusted = adjustFileExtension(obj.name, obj.content_type);
    const sanitized = sanitizeMountSegment(adjusted);
    if (sanitized) return `${DEFAULT_MOUNT_PATH}/${sanitized}`;
  }
  const suffix = obj.id.slice(-8);
  return `${DEFAULT_MOUNT_PATH}/object_${suffix}`;
}

import { describe, it, expect } from "@jest/globals";
import {
  sanitizeMountSegment,
  adjustFileExtension,
  repoBasename,
  getDefaultAgentMountPath,
  getDefaultObjectMountPath,
  DEFAULT_MOUNT_PATH,
} from "../../../src/utils/mount.js";
import type { Agent } from "../../../src/services/agentService.js";

describe("sanitizeMountSegment", () => {
  it("lowercases and replaces invalid characters", () => {
    expect(sanitizeMountSegment("My Agent Name")).toBe("my_agent_name");
  });

  it("collapses consecutive underscores but preserves hyphens", () => {
    expect(sanitizeMountSegment("foo---bar___baz")).toBe("foo---bar_baz");
    expect(sanitizeMountSegment("a___b")).toBe("a_b");
  });

  it("strips leading and trailing underscores", () => {
    expect(sanitizeMountSegment("__hello__")).toBe("hello");
  });

  it("preserves dots and hyphens", () => {
    expect(sanitizeMountSegment("my-file.txt")).toBe("my-file.txt");
  });

  it("returns empty string for all-special-character input", () => {
    expect(sanitizeMountSegment("!!!@@@###")).toBe("");
  });

  it("trims whitespace", () => {
    expect(sanitizeMountSegment("  spaced  ")).toBe("spaced");
  });

  it("handles empty string", () => {
    expect(sanitizeMountSegment("")).toBe("");
  });
});

describe("adjustFileExtension", () => {
  it("strips .tar.gz", () => {
    expect(adjustFileExtension("archive.tar.gz")).toBe("archive");
  });

  it("strips .tgz", () => {
    expect(adjustFileExtension("package.tgz")).toBe("package");
  });

  it("strips .zip", () => {
    expect(adjustFileExtension("bundle.zip")).toBe("bundle");
  });

  it("strips .tar.bz2", () => {
    expect(adjustFileExtension("data.tar.bz2")).toBe("data");
  });

  it("strips .tar.xz", () => {
    expect(adjustFileExtension("data.tar.xz")).toBe("data");
  });

  it("strips .gz", () => {
    expect(adjustFileExtension("file.gz")).toBe("file");
  });

  it("does not strip non-archive extensions", () => {
    expect(adjustFileExtension("readme.md")).toBe("readme.md");
  });

  it("strips extension based on contentType when no archive ext found", () => {
    expect(adjustFileExtension("file.dat", "application/gzip")).toBe("file");
  });

  it("does not strip when contentType does not match archive pattern", () => {
    expect(adjustFileExtension("file.dat", "text/plain")).toBe("file.dat");
  });

  it("case insensitive for archive extensions", () => {
    expect(adjustFileExtension("archive.TAR.GZ")).toBe("archive");
  });

  it("does not strip extension from dotless file via contentType", () => {
    expect(adjustFileExtension("archive", "application/gzip")).toBe("archive");
  });
});

describe("repoBasename", () => {
  it("extracts from HTTPS URL", () => {
    expect(repoBasename("https://github.com/owner/repo")).toBe("repo");
  });

  it("extracts from HTTPS URL with .git suffix", () => {
    expect(repoBasename("https://github.com/owner/repo.git")).toBe("repo");
  });

  it("extracts from SSH URL", () => {
    expect(repoBasename("git@github.com:owner/repo.git")).toBe("repo");
  });

  it("strips trailing slashes", () => {
    expect(repoBasename("https://github.com/owner/repo/")).toBe("repo");
  });

  it("strips query string and fragment", () => {
    expect(repoBasename("https://github.com/owner/repo?ref=main#readme")).toBe(
      "repo",
    );
  });

  it("handles whitespace around URL", () => {
    expect(repoBasename("  https://github.com/owner/repo  ")).toBe("repo");
  });

  it("returns undefined for empty string", () => {
    expect(repoBasename("")).toBeUndefined();
  });

  it("returns undefined for a bare word without path separator", () => {
    expect(repoBasename("justarepo")).toBeUndefined();
  });
});

describe("getDefaultAgentMountPath", () => {
  const makeAgent = (overrides: Partial<Agent>): Agent => ({
    id: "agt_test",
    name: "test-agent",
    version: "1.0.0",
    is_public: false,
    create_time_ms: Date.now(),
    ...overrides,
  });

  it("uses repo basename for git agents", () => {
    const agent = makeAgent({
      source: {
        type: "git",
        git: { repository: "https://github.com/org/my-repo.git" },
      },
    });
    expect(getDefaultAgentMountPath(agent)).toBe(`${DEFAULT_MOUNT_PATH}/my-repo`);
  });

  it("falls back to agent name when no git source", () => {
    const agent = makeAgent({
      name: "My Agent",
      source: { type: "npm", npm: { package_name: "my-pkg" } },
    });
    expect(getDefaultAgentMountPath(agent)).toBe(
      `${DEFAULT_MOUNT_PATH}/my_agent`,
    );
  });

  it("falls back to /agent when name sanitizes to empty", () => {
    const agent = makeAgent({
      name: "!!!",
      source: { type: "npm" },
    });
    expect(getDefaultAgentMountPath(agent)).toBe(`${DEFAULT_MOUNT_PATH}/agent`);
  });

  it("falls back to name when git repo basename fails", () => {
    const agent = makeAgent({
      name: "fallback-agent",
      source: { type: "git", git: { repository: "" } },
    });
    expect(getDefaultAgentMountPath(agent)).toBe(
      `${DEFAULT_MOUNT_PATH}/fallback-agent`,
    );
  });
});

describe("getDefaultObjectMountPath", () => {
  it("uses sanitized object name", () => {
    expect(
      getDefaultObjectMountPath({
        id: "obj_12345678",
        name: "My Data File",
      }),
    ).toBe(`${DEFAULT_MOUNT_PATH}/my_data_file`);
  });

  it("strips archive extensions from name", () => {
    expect(
      getDefaultObjectMountPath({
        id: "obj_12345678",
        name: "dataset.tar.gz",
        content_type: "application/gzip",
      }),
    ).toBe(`${DEFAULT_MOUNT_PATH}/dataset`);
  });

  it("falls back to object ID suffix when no name", () => {
    expect(
      getDefaultObjectMountPath({
        id: "obj_abcd1234efgh5678",
      }),
    ).toBe(`${DEFAULT_MOUNT_PATH}/object_efgh5678`);
  });

  it("falls back to object ID suffix when name sanitizes to empty", () => {
    expect(
      getDefaultObjectMountPath({
        id: "obj_abcd1234efgh5678",
        name: "!!!",
      }),
    ).toBe(`${DEFAULT_MOUNT_PATH}/object_efgh5678`);
  });

  it("uses last 8 chars of id for fallback", () => {
    expect(
      getDefaultObjectMountPath({
        id: "obj_short",
      }),
    ).toBe(`${DEFAULT_MOUNT_PATH}/object_bj_short`);
  });
});

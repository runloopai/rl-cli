/**
 * Create agent from a directory — reads config, packages directory, uploads, and registers.
 *
 * Reads .runloopignore (gitignore syntax) to determine which files to exclude from the tar.
 * Falls back to sensible defaults if no .runloopignore exists.
 */

import { readFile, stat, mkdtemp, rm, readdir } from "fs/promises";
import { join, basename, resolve, relative } from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { parse as parseYaml } from "yaml";
import ignore from "ignore";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

const DEFAULT_IGNORE_PATTERNS = [
  ".git",
  "node_modules",
  "__pycache__",
  ".venv",
  ".env",
  "dist",
  "build",
  ".DS_Store",
  "*.pyc",
  ".runloopignore",
];

interface AgentConfig {
  name?: string;
  version?: string;
  setup_commands?: string[];
  skills?: Array<{
    name: string;
    description?: string;
    definition: Record<string, unknown>;
  }>;
  webhooks?: Array<{
    url: string;
    events?: string[];
    secret?: string;
  }>;
}

interface CreateFromDirOptions {
  path: string;
  name?: string;
  version?: string;
  public?: boolean;
  output?: string;
}

/**
 * Recursively collect all file paths relative to root, respecting ignore patterns.
 */
async function collectFiles(
  root: string,
  ig: ReturnType<typeof ignore>,
): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(root, fullPath);

      // Check if this path should be ignored
      if (ig.ignores(relPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        // Also check directory with trailing slash
        if (ig.ignores(relPath + "/")) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(relPath);
      }
    }
  }

  await walk(root);
  return files;
}

export async function createFromDirCommand(options: CreateFromDirOptions) {
  try {
    const dirPath = resolve(options.path);

    // Verify directory exists
    const dirStat = await stat(dirPath);
    if (!dirStat.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    // Read agent config if it exists
    let config: AgentConfig = {};
    for (const configName of ["agent.yaml", "agent.yml", "agent.json"]) {
      const configPath = join(dirPath, configName);
      if (existsSync(configPath)) {
        const raw = await readFile(configPath, "utf-8");
        config = configName.endsWith(".json")
          ? JSON.parse(raw)
          : parseYaml(raw);
        console.error(`Using config from ${configName}`);
        break;
      }
    }

    // Resolve name and version (CLI flags override config)
    const agentName = options.name || config.name || basename(dirPath);
    const agentVersion = options.version || config.version;
    if (!agentVersion) {
      throw new Error(
        "Version is required. Provide --version or set 'version' in agent.yaml",
      );
    }

    // Build ignore filter from .runloopignore or defaults
    const ig = ignore();
    const ignorePath = join(dirPath, ".runloopignore");
    if (existsSync(ignorePath)) {
      const ignoreContent = await readFile(ignorePath, "utf-8");
      ig.add(ignoreContent);
      console.error("Using .runloopignore");
    } else {
      ig.add(DEFAULT_IGNORE_PATTERNS);
      console.error(
        "No .runloopignore found, using defaults: " +
          DEFAULT_IGNORE_PATTERNS.join(", "),
      );
    }

    // Also exclude agent config files from the tar
    ig.add(["agent.yaml", "agent.yml", "agent.json"]);

    // Collect files to include
    const files = await collectFiles(dirPath, ig);
    if (files.length === 0) {
      throw new Error("No files to package after applying ignore rules");
    }
    console.error(`Packaging ${files.length} files...`);

    // Create tar.gz in a temp directory
    const tmpDir = await mkdtemp(join(tmpdir(), "rl-agent-"));
    const tarPath = join(tmpDir, `${agentName}.tar.gz`);

    try {
      // Use system tar to create archive from the file list
      execFileSync("tar", ["-czf", tarPath, "-C", dirPath, ...files], {
        stdio: "pipe",
      });

      // Upload via object storage
      const client = getClient();
      const fileBuffer = await readFile(tarPath);

      // Step 1: Create object
      const createResponse = await client.objects.create({
        name: `${agentName}-${agentVersion}.tar.gz`,
        content_type: "tgz",
      });

      // Step 2: Upload
      const uploadResponse = await fetch(createResponse.upload_url!, {
        method: "PUT",
        body: fileBuffer,
        headers: {
          "Content-Length": fileBuffer.length.toString(),
        },
      });
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: HTTP ${uploadResponse.status}`);
      }

      // Step 3: Complete
      await client.objects.complete(createResponse.id);
      console.error(`Uploaded object: ${createResponse.id}`);

      // Step 4: Create agent with object source
      const body: Record<string, unknown> = {
        name: agentName,
        version: agentVersion,
        is_public: options.public || false,
        source: {
          type: "object",
          object: {
            object_id: createResponse.id,
            agent_setup: config.setup_commands || [],
          },
        },
      };

      if (config.skills && config.skills.length > 0) {
        body.skills = config.skills;
      }
      if (config.webhooks && config.webhooks.length > 0) {
        body.webhooks = config.webhooks;
      }

      const agent = await client.post("/v1/agents", { body });
      output(agent, { format: options.output, defaultFormat: "json" });
    } finally {
      // Clean up temp directory
      await rm(tmpDir, { recursive: true, force: true });
    }
  } catch (error) {
    outputError("Failed to create agent from directory", error);
  }
}

/**
 * Create agent command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface CreateAgentOptions {
  name: string;
  version: string;
  sourceType?: string;
  gitRepository?: string;
  gitRef?: string;
  npmPackage?: string;
  npmRegistryUrl?: string;
  pipPackage?: string;
  pipIndexUrl?: string;
  objectId?: string;
  setupCommands?: string;
  public?: boolean;
  output?: string;
}

export async function createAgentCommand(options: CreateAgentOptions) {
  try {
    const client = getClient();

    const body: Record<string, unknown> = {
      name: options.name,
      version: options.version,
      is_public: options.public || false,
    };

    // Build source config based on source type
    if (options.sourceType) {
      const setupCommands = options.setupCommands
        ? options.setupCommands
            .split("\n")
            .map((cmd: string) => cmd.trim())
            .filter((cmd: string) => cmd.length > 0)
        : undefined;

      switch (options.sourceType) {
        case "git": {
          if (!options.gitRepository) {
            throw new Error("--git-repository is required for git source type");
          }
          const git: Record<string, unknown> = {
            repository: options.gitRepository,
          };
          if (options.gitRef) git.ref = options.gitRef;
          if (setupCommands) git.agent_setup = setupCommands;
          body.source = { type: "git", git };
          break;
        }
        case "npm": {
          if (!options.npmPackage) {
            throw new Error("--npm-package is required for npm source type");
          }
          const npm: Record<string, unknown> = {
            package_name: options.npmPackage,
          };
          if (options.npmRegistryUrl) npm.registry_url = options.npmRegistryUrl;
          if (setupCommands) npm.agent_setup = setupCommands;
          body.source = { type: "npm", npm };
          break;
        }
        case "pip": {
          if (!options.pipPackage) {
            throw new Error("--pip-package is required for pip source type");
          }
          const pip: Record<string, unknown> = {
            package_name: options.pipPackage,
          };
          if (options.pipIndexUrl) pip.registry_url = options.pipIndexUrl;
          if (setupCommands) pip.agent_setup = setupCommands;
          body.source = { type: "pip", pip };
          break;
        }
        case "object": {
          if (!options.objectId) {
            throw new Error("--object-id is required for object source type");
          }
          const object: Record<string, unknown> = {
            object_id: options.objectId,
          };
          if (setupCommands) object.agent_setup = setupCommands;
          body.source = { type: "object", object };
          break;
        }
        default:
          throw new Error(
            `Unsupported source type: ${options.sourceType}. Must be one of: git, npm, pip, object`,
          );
      }
    }

    const agent = await client.post("/v1/agents", { body });
    output(agent, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to create agent", error);
  }
}

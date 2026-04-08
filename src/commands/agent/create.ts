/**
 * Create agent command
 */
import chalk from "chalk";
import { createAgent } from "../../services/agentService.js";
import { output, outputError } from "../../utils/output.js";

interface CreateOptions {
  name: string;
  agentVersion: string;
  source: string;
  package?: string;
  registryUrl?: string;
  repository?: string;
  ref?: string;
  objectId?: string;
  setupCommands?: string[];
  output?: string;
}

export async function createAgentCommand(
  options: CreateOptions,
): Promise<void> {
  try {
    const sourceType = options.source;
    let source: any;

    switch (sourceType) {
      case "npm":
        if (!options.package) {
          throw new Error("--package is required for npm source type");
        }
        source = {
          type: "npm",
          npm: {
            package_name: options.package,
            registry_url: options.registryUrl || undefined,
            agent_setup: options.setupCommands || undefined,
          },
        };
        break;
      case "pip":
        if (!options.package) {
          throw new Error("--package is required for pip source type");
        }
        source = {
          type: "pip",
          pip: {
            package_name: options.package,
            registry_url: options.registryUrl || undefined,
            agent_setup: options.setupCommands || undefined,
          },
        };
        break;
      case "git":
        if (!options.repository) {
          throw new Error("--repository is required for git source type");
        }
        source = {
          type: "git",
          git: {
            repository: options.repository,
            ref: options.ref || undefined,
            agent_setup: options.setupCommands || undefined,
          },
        };
        break;
      case "object":
        if (!options.objectId) {
          throw new Error("--object-id is required for object source type");
        }
        source = {
          type: "object",
          object: {
            object_id: options.objectId,
            agent_setup: options.setupCommands || undefined,
          },
        };
        break;
      default:
        throw new Error(
          `Unknown source type: ${sourceType}. Use npm, pip, git, or object.`,
        );
    }

    const agent = await createAgent({
      name: options.name,
      version: options.agentVersion,
      source,
    });

    const format = options.output || "text";
    if (format !== "text") {
      output(agent, { format, defaultFormat: "json" });
    } else {
      console.log(chalk.green("✓") + " Agent created successfully");
      console.log();
      console.log(`  ${chalk.bold("Name:")}    ${agent.name}`);
      console.log(`  ${chalk.bold("ID:")}      ${chalk.dim(agent.id)}`);
      console.log(`  ${chalk.bold("Version:")} ${agent.version}`);
      console.log(`  ${chalk.bold("Source:")}  ${sourceType}`);
    }
  } catch (error) {
    outputError("Failed to create agent", error);
  }
}

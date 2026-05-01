/**
 * Create agent command
 */
import chalk from "chalk";
import { createAgent } from "../../services/agentService.js";
import { output, outputError } from "../../utils/output.js";

interface CreateOptions {
  name: string;
  agentVersion?: string;
  source: string;
  package?: string;
  registryUrl?: string;
  repository?: string;
  ref?: string;
  objectId?: string;
  setupCommands?: string[];
  output?: string;
}

// Maps each source type to the options it accepts (beyond --setup-commands, which all types accept)
const validOptionsBySource: Record<string, (keyof CreateOptions)[]> = {
  npm: ["package", "registryUrl"],
  pip: ["package", "registryUrl"],
  git: ["repository", "ref"],
  object: ["objectId"],
};

// All source-specific option flags (for error messages)
const allSourceOptions: { key: keyof CreateOptions; flag: string }[] = [
  { key: "package", flag: "--package" },
  { key: "registryUrl", flag: "--registry-url" },
  { key: "repository", flag: "--repository" },
  { key: "ref", flag: "--ref" },
  { key: "objectId", flag: "--object-id" },
];

function rejectInvalidOptions(
  sourceType: string,
  options: CreateOptions,
): void {
  const allowed = validOptionsBySource[sourceType] || [];
  const invalid = allSourceOptions
    .filter(
      (opt) => options[opt.key] !== undefined && !allowed.includes(opt.key),
    )
    .map((opt) => opt.flag);

  if (invalid.length > 0) {
    throw new Error(
      `${invalid.join(", ")} cannot be used with ${sourceType} source type`,
    );
  }
}

function buildSourceOptions(
  sourceType: string,
  options: CreateOptions,
): Record<string, unknown> {
  rejectInvalidOptions(sourceType, options);

  switch (sourceType) {
    case "npm":
    case "pip":
      if (!options.package) {
        throw new Error(`--package is required for ${sourceType} source type`);
      }
      return {
        package_name: options.package,
        registry_url: options.registryUrl || undefined,
        agent_setup: options.setupCommands || undefined,
      };
    case "git":
      if (!options.repository) {
        throw new Error("--repository is required for git source type");
      }
      return {
        repository: options.repository,
        ref: options.ref || undefined,
        agent_setup: options.setupCommands || undefined,
      };
    case "object":
      if (!options.objectId) {
        throw new Error("--object-id is required for object source type");
      }
      return {
        object_id: options.objectId,
        agent_setup: options.setupCommands || undefined,
      };
    default:
      throw new Error(
        `Unknown source type: ${sourceType}. Use npm, pip, git, or object.`,
      );
  }
}

export async function createAgentCommand(
  options: CreateOptions,
): Promise<void> {
  try {
    const sourceType = options.source;
    const sourceOptions = buildSourceOptions(sourceType, options);

    const agent = await createAgent({
      name: options.name,
      ...(options.agentVersion ? { version: options.agentVersion } : {}),
      source: { type: sourceType, [sourceType]: sourceOptions },
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

/**
 * Run benchmark job command
 */

import { createBenchmarkJob } from "../../services/benchmarkJobService.js";
import { listBenchmarks } from "../../services/benchmarkService.js";
import { output, outputError } from "../../utils/output.js";

// Supported agents and their required environment variables
const SUPPORTED_AGENTS = {
  "claude-code": {
    requiredEnvVars: ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"],
    requiresAny: true, // At least one of these is required
  },
  codex: {
    requiredEnvVars: ["OPENAI_API_KEY"],
    requiresAny: false,
  },
  opencode: {
    requiredEnvVars: ["ANTHROPIC_API_KEY"],
    requiresAny: false,
  },
  goose: {
    requiredEnvVars: ["ANTHROPIC_API_KEY"],
    requiresAny: false,
  },
  "gemini-cli": {
    requiredEnvVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    requiresAny: true, // At least one of these is required
  },
} as const;

type SupportedAgent = keyof typeof SUPPORTED_AGENTS;

interface RunOptions {
  agent: string;
  model: string;
  benchmark?: string;
  scenarios?: string[];
  jobName?: string;
  envVars?: string[];
  secrets?: string[];
  timeout?: string;
  nAttempts?: string;
  nConcurrentTrials?: string;
  timeoutMultiplier?: string;
  output?: string;
}

// Parse environment variables from KEY=value format
function parseEnvVars(envVars: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const envVar of envVars) {
    const eqIndex = envVar.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(
        `Invalid environment variable format: ${envVar}. Expected KEY=value`,
      );
    }
    const key = envVar.substring(0, eqIndex);
    const value = envVar.substring(eqIndex + 1);
    result[key] = value;
  }
  return result;
}

// Parse secrets from ENV_VAR=SECRET_NAME format
function parseSecrets(secrets: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const secret of secrets) {
    const eqIndex = secret.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(
        `Invalid secret format: ${secret}. Expected ENV_VAR=SECRET_NAME`,
      );
    }
    const envVarName = secret.substring(0, eqIndex);
    const secretName = secret.substring(eqIndex + 1);
    result[envVarName] = secretName;
  }
  return result;
}

// Validate agent is supported
function validateAgent(agent: string): asserts agent is SupportedAgent {
  if (!(agent in SUPPORTED_AGENTS)) {
    const supportedList = Object.keys(SUPPORTED_AGENTS).join(", ");
    throw new Error(
      `Unsupported agent: ${agent}. Supported agents: ${supportedList}`,
    );
  }
}

// Get env vars from current environment for the agent
function getAgentEnvVars(agent: SupportedAgent): Record<string, string> {
  const agentConfig = SUPPORTED_AGENTS[agent];
  const envVars: Record<string, string> = {};

  for (const varName of agentConfig.requiredEnvVars) {
    const value = process.env[varName];
    if (value) {
      envVars[varName] = value;
    }
  }

  return envVars;
}

// Validate that required env vars are present
function validateEnvVars(
  agent: SupportedAgent,
  providedEnvVars: Record<string, string>,
): void {
  const agentConfig = SUPPORTED_AGENTS[agent];
  const allEnvVars = { ...getAgentEnvVars(agent), ...providedEnvVars };

  if (agentConfig.requiresAny) {
    // At least one of the required env vars must be present
    const hasAny = agentConfig.requiredEnvVars.some(
      (varName) => allEnvVars[varName],
    );
    if (!hasAny) {
      throw new Error(
        `Agent ${agent} requires at least one of: ${agentConfig.requiredEnvVars.join(", ")}. ` +
          `Set via --env-vars or as environment variables.`,
      );
    }
  } else {
    // For agents that don't use requiresAny, we just need at least one key
    // since different models may need different keys
    const hasAny = agentConfig.requiredEnvVars.some(
      (varName) => allEnvVars[varName],
    );
    if (!hasAny) {
      throw new Error(
        `Agent ${agent} requires environment variables. Expected one of: ${agentConfig.requiredEnvVars.join(", ")}. ` +
          `Set via --env-vars or as environment variables.`,
      );
    }
  }
}

// Resolve benchmark name to ID if needed
async function resolveBenchmarkId(benchmarkIdOrName: string): Promise<string> {
  // If it looks like an ID (starts with bm_ or similar), return as-is
  if (
    benchmarkIdOrName.startsWith("bm_") ||
    benchmarkIdOrName.startsWith("bmk_")
  ) {
    return benchmarkIdOrName;
  }

  // Otherwise, search for benchmark by name
  const result = await listBenchmarks({
    limit: 100,
    search: benchmarkIdOrName,
  });

  // Look for exact name match
  const exactMatch = result.benchmarks.find(
    (b) => b.name === benchmarkIdOrName,
  );

  if (exactMatch) {
    return exactMatch.id;
  }

  if (result.benchmarks.length === 0) {
    throw new Error(`No benchmark found with name: ${benchmarkIdOrName}`);
  }

  // If no exact match but we have results, suggest them
  const suggestions = result.benchmarks
    .slice(0, 5)
    .map((b) => `  - ${b.name} (${b.id})`)
    .join("\n");
  throw new Error(
    `No exact match for benchmark "${benchmarkIdOrName}". Did you mean:\n${suggestions}`,
  );
}

export async function runBenchmarkJob(options: RunOptions) {
  try {
    // Validate agent
    validateAgent(options.agent);
    const agent = options.agent as SupportedAgent;

    // Parse provided env vars and secrets
    const providedEnvVars = options.envVars
      ? parseEnvVars(options.envVars)
      : {};
    const providedSecrets = options.secrets
      ? parseSecrets(options.secrets)
      : {};

    // Merge environment variables (CLI-provided override auto-detected)
    const environmentVariables = {
      ...getAgentEnvVars(agent),
      ...providedEnvVars,
    };

    // Validate required env vars
    validateEnvVars(agent, providedEnvVars);

    // Validate that either benchmark or scenarios is provided, but not both
    if (!options.benchmark && !options.scenarios) {
      throw new Error(
        "Either --benchmark or --scenarios must be specified",
      );
    }
    if (options.benchmark && options.scenarios) {
      throw new Error("Cannot specify both --benchmark and --scenarios");
    }

    // Resolve benchmark ID if name was provided
    let benchmarkId: string | undefined;
    if (options.benchmark) {
      benchmarkId = await resolveBenchmarkId(options.benchmark);
    }

    // Build orchestrator config with defaults
    const orchestratorConfig = {
      nConcurrentTrials: options.nConcurrentTrials
        ? parseInt(options.nConcurrentTrials, 10)
        : 10,
      nAttempts: options.nAttempts ? parseInt(options.nAttempts, 10) : 1,
      timeoutMultiplier: options.timeoutMultiplier
        ? parseFloat(options.timeoutMultiplier)
        : 1.0,
      quiet: false,
    };

    // Create the benchmark job
    const job = await createBenchmarkJob({
      name: options.jobName,
      benchmarkId,
      scenarioIds: options.scenarios,
      agentConfigs: [
        {
          name: agent,
          modelName: options.model,
          timeoutSeconds: options.timeout
            ? parseInt(options.timeout, 10)
            : 1800,
          environmentVariables,
          secrets:
            Object.keys(providedSecrets).length > 0
              ? providedSecrets
              : undefined,
        },
      ],
      orchestratorConfig,
    });

    // Output result
    if (!options.output || options.output === "text") {
      console.log(job.id);
    } else {
      output(job, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to run benchmark job", error);
  }
}

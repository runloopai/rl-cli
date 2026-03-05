/**
 * Run benchmark job command
 */

import chalk from "chalk";
import { createBenchmarkJob } from "../../services/benchmarkJobService.js";
import {
  listBenchmarks,
  listPublicBenchmarks,
} from "../../services/benchmarkService.js";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

// Secret name prefix for benchmark job secrets
const SECRET_PREFIX = "BMJ_";

// Supported agents and their required environment variables (mapped to BMJ_* secrets)
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

// Check if a secret exists by name
async function secretExists(secretName: string): Promise<boolean> {
  const client = getClient();
  const result = await client.secrets.list({ limit: 5000 });
  return result.secrets?.some((s) => s.name === secretName) ?? false;
}

// Create a secret
async function createSecret(name: string, value: string): Promise<void> {
  const client = getClient();
  await client.secrets.create({ name, value });
}

// Ensure agent secrets exist, creating them from env vars if needed
// Returns the secrets mapping (ENV_VAR -> BMJ_ENV_VAR)
async function ensureAgentSecrets(
  agent: SupportedAgent,
): Promise<Record<string, string>> {
  const agentConfig = SUPPORTED_AGENTS[agent];
  const secrets: Record<string, string> = {};

  for (const varName of agentConfig.requiredEnvVars) {
    const secretName = `${SECRET_PREFIX}${varName}`;
    const envValue = process.env[varName];

    // Check if secret exists
    const exists = await secretExists(secretName);

    if (exists) {
      console.log(chalk.dim(`Secret ${secretName} exists`));
      secrets[varName] = secretName;
    } else if (envValue) {
      // Create secret from env var
      console.log(
        chalk.cyan(`Creating secret ${secretName} from ${varName} env var`),
      );
      await createSecret(secretName, envValue);
      secrets[varName] = secretName;
    } else {
      // No secret and no env var - skip (will be validated later if required)
      console.log(
        chalk.yellow(
          `Secret ${secretName} not found and ${varName} not set in environment`,
        ),
      );
    }
  }

  return secrets;
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

  // Search both user benchmarks and public benchmarks
  const [userResult, publicResult] = await Promise.all([
    listBenchmarks({
      limit: 100,
      search: benchmarkIdOrName,
    }),
    listPublicBenchmarks({
      limit: 100,
      search: benchmarkIdOrName,
    }),
  ]);

  // Combine results
  const allBenchmarks = [...userResult.benchmarks, ...publicResult.benchmarks];

  // Look for exact name match
  const exactMatch = allBenchmarks.find((b) => b.name === benchmarkIdOrName);

  if (exactMatch) {
    return exactMatch.id;
  }

  if (allBenchmarks.length === 0) {
    throw new Error(`No benchmark found with name: ${benchmarkIdOrName}`);
  }

  // If no exact match but we have results, suggest them
  const suggestions = allBenchmarks
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

    // Ensure agent secrets exist (auto-create from env vars if needed)
    // Maps ENV_VAR -> BMJ_ENV_VAR (e.g., ANTHROPIC_API_KEY -> BMJ_ANTHROPIC_API_KEY)
    const agentSecrets = await ensureAgentSecrets(agent);

    // Validate that at least one required secret is available
    const agentConfig = SUPPORTED_AGENTS[agent];
    if (agentConfig.requiresAny) {
      const hasAny = agentConfig.requiredEnvVars.some(
        (varName) => agentSecrets[varName],
      );
      if (!hasAny) {
        throw new Error(
          `Agent ${agent} requires at least one of: ${agentConfig.requiredEnvVars.join(", ")}. ` +
            `Create secrets (${agentConfig.requiredEnvVars.map((v) => `${SECRET_PREFIX}${v}`).join(", ")}) ` +
            `or set environment variables.`,
        );
      }
    } else {
      const hasAny = agentConfig.requiredEnvVars.some(
        (varName) => agentSecrets[varName],
      );
      if (!hasAny) {
        throw new Error(
          `Agent ${agent} requires secrets. Expected one of: ${agentConfig.requiredEnvVars.map((v) => `${SECRET_PREFIX}${v}`).join(", ")}. ` +
            `Create secrets or set environment variables.`,
        );
      }
    }

    // Combine agent secrets with user-provided secrets
    const secrets = {
      ...agentSecrets,
      ...providedSecrets,
    };

    // Validate that either benchmark or scenarios is provided, but not both
    if (!options.benchmark && !options.scenarios) {
      throw new Error("Either --benchmark or --scenarios must be specified");
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
          environmentVariables:
            Object.keys(providedEnvVars).length > 0
              ? providedEnvVars
              : undefined,
          secrets,
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

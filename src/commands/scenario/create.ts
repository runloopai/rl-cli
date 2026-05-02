import { readFile } from "fs/promises";
import { createScenario } from "../../services/scenarioService.js";
import { output, outputError } from "../../utils/output.js";
import { parseMetadata } from "../../utils/metadata.js";
import type { ScenarioCreateParams } from "@runloop/api-client/resources/scenarios/scenarios";

interface CreateScenarioOptions {
  name: string;
  problemStatement: string;
  scoringCommand?: string;
  scoringFile?: string;
  blueprint?: string;
  snapshot?: string;
  workingDirectory?: string;
  referenceOutput?: string;
  referenceOutputFile?: string;
  metadata?: string[];
  requiredEnvVars?: string[];
  requiredSecrets?: string[];
  scorerTimeout?: string;
  validationType?: string;
  output?: string;
}

export async function createScenarioCommand(options: CreateScenarioOptions) {
  try {
    if (!options.scoringCommand && !options.scoringFile) {
      return outputError(
        "At least one of --scoring-command or --scoring-file is required",
      );
    }

    let scoringContract: ScenarioCreateParams["scoring_contract"];

    if (options.scoringFile) {
      const contents = await readFile(options.scoringFile, "utf-8");
      scoringContract = JSON.parse(contents);
    } else if (options.scoringCommand) {
      scoringContract = {
        scoring_function_parameters: [
          {
            name: "default",
            weight: 1.0,
            scorer: {
              type: "command_scorer" as const,
              command: options.scoringCommand,
            },
          },
        ],
      };
    } else {
      return outputError("Scoring contract is required");
    }

    const params: ScenarioCreateParams = {
      name: options.name,
      input_context: {
        problem_statement: options.problemStatement,
      },
      scoring_contract: scoringContract,
    };

    if (options.blueprint || options.snapshot || options.workingDirectory) {
      params.environment_parameters = {};
      if (options.blueprint) {
        params.environment_parameters.blueprint_id = options.blueprint;
      }
      if (options.snapshot) {
        params.environment_parameters.snapshot_id = options.snapshot;
      }
      if (options.workingDirectory) {
        params.environment_parameters.working_directory =
          options.workingDirectory;
      }
    }

    if (options.referenceOutputFile) {
      params.reference_output = await readFile(
        options.referenceOutputFile,
        "utf-8",
      );
    } else if (options.referenceOutput) {
      params.reference_output = options.referenceOutput;
    }

    if (options.metadata) {
      params.metadata = parseMetadata(options.metadata);
    }

    if (options.requiredEnvVars) {
      params.required_environment_variables = options.requiredEnvVars;
    }

    if (options.requiredSecrets) {
      params.required_secret_names = options.requiredSecrets;
    }

    if (options.scorerTimeout) {
      params.scorer_timeout_sec = parseInt(options.scorerTimeout, 10);
    }

    if (options.validationType) {
      params.validation_type = options.validationType as
        | "UNSPECIFIED"
        | "FORWARD"
        | "REVERSE"
        | "EVALUATION";
    }

    const scenario = await createScenario(params);
    output(scenario, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to create scenario", error);
  }
}

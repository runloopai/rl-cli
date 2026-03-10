/**
 * Display scenario definition details in a readable format.
 */

import chalk from "chalk";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import type { ScenarioView } from "@runloop/api-client/resources/scenarios";

interface InfoOptions {
  output?: string;
}

/** Format a scoring function's details for display */
function formatScorer(
  scorer: ScenarioView["scoring_contract"]["scoring_function_parameters"][number],
): string {
  const lines: string[] = [];
  const s = scorer.scorer;
  lines.push(`    type: ${s.type}`);
  lines.push(`    weight: ${scorer.weight}`);

  switch (s.type) {
    case "test_based_scorer":
      if (s.test_command) lines.push(`    test_command: ${s.test_command}`);
      if (s.test_files) {
        for (const tf of s.test_files) {
          lines.push(`    file: ${tf.file_path || "(unnamed)"}`);
          if (tf.file_contents) {
            const indented = tf.file_contents
              .split("\n")
              .map((l) => `      ${l}`)
              .join("\n");
            lines.push(indented);
          }
        }
      }
      break;
    case "bash_script_scorer":
      if (s.bash_script) {
        lines.push("    script:");
        lines.push(
          s.bash_script
            .split("\n")
            .map((l) => `      ${l}`)
            .join("\n"),
        );
      }
      break;
    case "command_scorer":
      if (s.command) lines.push(`    command: ${s.command}`);
      break;
    case "python_script_scorer":
      if (s.python_version_constraint)
        lines.push(`    python: ${s.python_version_constraint}`);
      if (s.requirements_contents)
        lines.push(`    requirements: ${s.requirements_contents}`);
      lines.push("    script:");
      lines.push(
        s.python_script
          .split("\n")
          .map((l) => `      ${l}`)
          .join("\n"),
      );
      break;
    case "ast_grep_scorer":
      lines.push(`    pattern: ${s.pattern}`);
      lines.push(`    search_directory: ${s.search_directory}`);
      if (s.lang) lines.push(`    lang: ${s.lang}`);
      break;
    case "custom_scorer":
      lines.push(`    custom_type: ${s.custom_scorer_type}`);
      if (s.scorer_params)
        lines.push(`    params: ${JSON.stringify(s.scorer_params)}`);
      break;
  }

  return lines.join("\n");
}

function printScenario(scenario: ScenarioView): void {
  console.log(chalk.bold("Scenario: ") + scenario.name);
  console.log(chalk.dim("ID: ") + scenario.id);
  console.log(chalk.dim("Status: ") + scenario.status);
  if (scenario.validation_type && scenario.validation_type !== "UNSPECIFIED") {
    console.log(chalk.dim("Validation: ") + scenario.validation_type);
  }

  // Environment
  const env = scenario.environment;
  if (env) {
    console.log();
    console.log(chalk.bold("Environment:"));
    if (env.blueprint_id) console.log(`  blueprint: ${env.blueprint_id}`);
    if (env.snapshot_id) console.log(`  snapshot: ${env.snapshot_id}`);
    if (env.working_directory)
      console.log(`  working_directory: ${env.working_directory}`);
    if (env.launch_parameters) {
      const lp = env.launch_parameters;
      if (lp.architecture) console.log(`  architecture: ${lp.architecture}`);
      if (lp.resource_size_request)
        console.log(`  resources: ${lp.resource_size_request}`);
      if (lp.launch_commands?.length) {
        console.log("  launch_commands:");
        for (const cmd of lp.launch_commands) {
          console.log(`    - ${cmd}`);
        }
      }
    }
  }

  // Required env vars / secrets
  if (scenario.required_environment_variables?.length) {
    console.log();
    console.log(chalk.bold("Required Environment Variables:"));
    for (const v of scenario.required_environment_variables) {
      console.log(`  - ${v}`);
    }
  }
  if (scenario.required_secret_names?.length) {
    console.log();
    console.log(chalk.bold("Required Secrets:"));
    for (const s of scenario.required_secret_names) {
      console.log(`  - ${s}`);
    }
  }

  // Metadata
  if (scenario.metadata && Object.keys(scenario.metadata).length > 0) {
    console.log();
    console.log(chalk.bold("Metadata:"));
    for (const [k, v] of Object.entries(scenario.metadata)) {
      console.log(`  ${k}: ${v}`);
    }
  }

  // Problem statement
  console.log();
  console.log(chalk.bold("Problem Statement:"));
  console.log(indent(scenario.input_context.problem_statement, 2));

  if (scenario.input_context.additional_context) {
    console.log();
    console.log(chalk.bold("Additional Context:"));
    console.log(
      indent(
        JSON.stringify(scenario.input_context.additional_context, null, 2),
        2,
      ),
    );
  }

  // Reference output
  if (scenario.reference_output) {
    console.log();
    console.log(chalk.bold("Reference Output:"));
    console.log(indent(scenario.reference_output, 2));
  }

  // Scoring
  const scorers = scenario.scoring_contract.scoring_function_parameters;
  if (scorers.length > 0) {
    console.log();
    console.log(chalk.bold("Scoring Functions:"));
    for (const scorer of scorers) {
      console.log(`  ${chalk.cyan(scorer.name)}:`);
      console.log(formatScorer(scorer));
    }
  }

  if (scenario.scorer_timeout_sec) {
    console.log();
    console.log(chalk.dim(`Scorer timeout: ${scenario.scorer_timeout_sec}s`));
  }
}

function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((l) => pad + l)
    .join("\n");
}

export async function scenarioInfo(id: string, options: InfoOptions = {}) {
  try {
    const client = getClient();
    const scenario = await client.scenarios.retrieve(id);

    if (options.output && options.output !== "text") {
      output(scenario, { format: options.output, defaultFormat: "json" });
    } else {
      printScenario(scenario);
    }
  } catch (error) {
    outputError("Failed to get scenario info", error);
  }
}

/**
 * Create blueprint command
 */

import { readFile } from "fs/promises";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface CreateBlueprintOptions {
  name: string;
  dockerfile?: string;
  dockerfilePath?: string;
  systemSetupCommands?: string[];
  resources?: string;
  architecture?: string;
  availablePorts?: string[];
  root?: boolean;
  user?: string;
  output?: string;
}

export async function createBlueprint(options: CreateBlueprintOptions) {
  try {
    const client = getClient();

    // Read dockerfile from file if path is provided
    let dockerfileContents = options.dockerfile;
    if (options.dockerfilePath) {
      dockerfileContents = await readFile(options.dockerfilePath, "utf-8");
    }

    // Parse user parameters
    let userParameters = undefined;
    if (options.user && options.root) {
      outputError("Only one of --user or --root can be specified");
    } else if (options.user) {
      const [username, uid] = options.user.split(":");
      if (!username || !uid) {
        outputError("User must be in format 'username:uid'");
      }
      userParameters = { username, uid: parseInt(uid) };
    } else if (options.root) {
      userParameters = { username: "root", uid: 0 };
    }

    // Build launch parameters
    const launchParameters: Record<string, unknown> = {};
    if (options.resources) {
      launchParameters.resource_size_request = options.resources;
    }
    if (options.architecture) {
      launchParameters.architecture = options.architecture;
    }
    if (options.availablePorts) {
      launchParameters.available_ports = options.availablePorts.map((port) => parseInt(port, 10));
    }
    if (userParameters) {
      launchParameters.user_parameters = userParameters;
    }

    const blueprint = await client.blueprints.create({
      name: options.name,
      dockerfile: dockerfileContents,
      system_setup_commands: options.systemSetupCommands,
      launch_parameters: launchParameters as Parameters<typeof client.blueprints.create>[0]["launch_parameters"],
    });

    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      console.log(blueprint.id);
    } else {
      output(blueprint, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to create blueprint", error);
  }
}

/**
 * Preview blueprint command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface PreviewBlueprintOptions {
  name: string;
  dockerfile?: string;
  systemSetupCommands?: string[];
  resources?: string;
  architecture?: string;
  availablePorts?: string[];
  root?: boolean;
  user?: string;
  output?: string;
}

export async function previewBlueprint(options: PreviewBlueprintOptions) {
  try {
    const client = getClient();
    
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
    
    const preview = await client.blueprints.preview({
      name: options.name,
      dockerfile: options.dockerfile,
      system_setup_commands: options.systemSetupCommands,
      launch_parameters: launchParameters as Parameters<typeof client.blueprints.preview>[0]["launch_parameters"],
    });

    output(preview, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to preview blueprint", error);
  }
}

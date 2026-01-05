/**
 * Create devbox command
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface CreateOptions {
  name?: string;
  template?: string;
  blueprint?: string;
  resources?: string;
  architecture?: string;
  entrypoint?: string;
  availablePorts?: string[];
  root?: boolean;
  user?: string;
  output?: string;
}

export async function createDevbox(options: CreateOptions = {}) {
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
    if (options.entrypoint) {
      launchParameters.entrypoint = options.entrypoint;
    }
    if (options.availablePorts) {
      launchParameters.available_ports = options.availablePorts.map(p => parseInt(p, 10));
    }
    if (userParameters) {
      launchParameters.user_parameters = userParameters;
    }
    
    // Build create request
    const createRequest: Record<string, unknown> = {
      name: options.name || `devbox-${Date.now()}`,
    };
    if (options.template) {
      createRequest.snapshot_id = options.template;
    }
    if (options.blueprint) {
      createRequest.blueprint_id = options.blueprint;
    }
    if (Object.keys(launchParameters).length > 0) {
      createRequest.launch_parameters = launchParameters;
    }
    
    const devbox = await client.devboxes.create(createRequest as Parameters<typeof client.devboxes.create>[0]);
    
    // Default: just output the ID for easy scripting
    if (!options.output || options.output === "text") {
      console.log(devbox.id);
    } else {
      output(devbox, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to create devbox", error);
  }
}

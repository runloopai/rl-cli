import { readFile } from "fs/promises";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { parseMetadata } from "../../utils/metadata.js";

interface CreateBlueprintOptions {
  name?: string;
  base?: string;
  dockerfile?: string;
  dockerfilePath?: string;
  systemSetupCommands?: string[];
  resources?: string;
  architecture?: string;
  availablePorts?: string[];
  root?: boolean;
  user?: string;
  metadata?: string[];
  output?: string;
}

export async function createBlueprint(options: CreateBlueprintOptions) {
  try {
    const client = getClient();

    let baseParams: Record<string, unknown> = {};
    let baseName: string | undefined;
    let baseMetadata: Record<string, string> | undefined;

    if (options.base) {
      let source;
      if (options.base.startsWith("bpt_")) {
        source = await client.blueprints.retrieve(options.base);
      } else {
        const result = await client.blueprints.list({ name: options.base });
        const blueprints = result.blueprints || [];
        if (blueprints.length === 0) {
          return outputError(`Base blueprint not found: ${options.base}`);
        }
        source =
          blueprints.find((b) => b.name === options.base) || blueprints[0];
      }

      const {
        name: _n,
        dockerfile: _d,
        base_blueprint_id: _b,
        base_blueprint_name: _bn,
        ...inheritedParams
      } = (source.parameters ?? {}) as unknown as Record<string, unknown>;
      baseParams = {
        ...inheritedParams,
        base_blueprint_id: source.id,
      };
      baseName = source.name || "blueprint";
      baseMetadata = source.metadata as Record<string, string> | undefined;
    }

    const name = options.name ?? (baseName ? baseName + "-copy" : undefined);
    if (!name) {
      return outputError("--name is required (or use --base to derive one)");
    }

    let dockerfileContents = options.dockerfile;
    if (options.dockerfilePath) {
      dockerfileContents = await readFile(options.dockerfilePath, "utf-8");
    }

    let userParameters = undefined;
    if (options.user && options.root) {
      return outputError("Only one of --user or --root can be specified");
    } else if (options.user) {
      const [username, uid] = options.user.split(":");
      if (!username || !uid) {
        return outputError("User must be in format 'username:uid'");
      }
      userParameters = { username, uid: parseInt(uid) };
    } else if (options.root) {
      userParameters = { username: "root", uid: 0 };
    }

    const launchParameters: Record<string, unknown> = {};
    if (options.resources) {
      launchParameters.resource_size_request = options.resources;
    }
    if (options.architecture) {
      launchParameters.architecture = options.architecture;
    }
    if (options.availablePorts) {
      launchParameters.available_ports = options.availablePorts.map((port) =>
        parseInt(port, 10),
      );
    }
    if (userParameters) {
      launchParameters.user_parameters = userParameters;
    }

    const metadata = options.metadata
      ? parseMetadata(options.metadata)
      : (baseMetadata ?? undefined);

    const overrides: Record<string, unknown> = { name };
    if (dockerfileContents !== undefined) {
      overrides.dockerfile = dockerfileContents;
      delete baseParams.base_blueprint_id;
    }
    if (options.systemSetupCommands)
      overrides.system_setup_commands = options.systemSetupCommands;
    if (Object.keys(launchParameters).length > 0)
      overrides.launch_parameters = launchParameters;
    if (metadata !== undefined) overrides.metadata = metadata;

    const createParams = { ...baseParams, ...overrides };

    const blueprint = await client.blueprints.create(
      createParams as unknown as Parameters<typeof client.blueprints.create>[0],
    );

    output(blueprint, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to create blueprint", error);
  }
}

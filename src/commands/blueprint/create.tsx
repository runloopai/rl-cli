import React from "react";
import { Box, Text } from "ink";
import { getClient } from "../../utils/client.js";
import { Header } from "../../components/Header.js";
import { Banner } from "../../components/Banner.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { SuccessMessage } from "../../components/SuccessMessage.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { createExecutor } from "../../utils/CommandExecutor.js";
import { colors } from "../../utils/theme.js";
import { readFile } from "fs/promises";

interface CreateBlueprintOptions {
  name: string;
  dockerfile?: string;
  dockerfilePath?: string;
  systemSetupCommands?: string[];
  resources?: string;
  architecture?: string;
  availablePorts?: number[];
  root?: boolean;
  user?: string;
  outputFormat?: string;
}

const CreateBlueprintUI: React.FC<{
  name: string;
  dockerfile?: string;
  dockerfilePath?: string;
  systemSetupCommands?: string[];
  resources?: string;
  architecture?: string;
  availablePorts?: number[];
  root?: boolean;
  user?: string;
}> = ({ 
  name, 
  dockerfile, 
  dockerfilePath, 
  systemSetupCommands, 
  resources, 
  architecture, 
  availablePorts, 
  root, 
  user 
}) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const createBlueprint = async () => {
      try {
        const client = getClient();
        
        // Read dockerfile from file if path is provided
        let dockerfileContents = dockerfile;
        if (dockerfilePath) {
          dockerfileContents = await readFile(dockerfilePath, "utf-8");
        }

        // Parse user parameters
        let userParameters = undefined;
        if (user && root) {
          throw new Error("Only one of --user or --root can be specified");
        } else if (user) {
          const [username, uid] = user.split(":");
          if (!username || !uid) {
            throw new Error("User must be in format 'username:uid'");
          }
          userParameters = { username, uid: parseInt(uid) };
        } else if (root) {
          userParameters = { username: "root", uid: 0 };
        }

        const blueprint = await client.blueprints.create({
          name,
          dockerfile: dockerfileContents,
          system_setup_commands: systemSetupCommands,
          launch_parameters: {
            resource_size_request: resources as any,
            architecture: architecture as any,
            available_ports: availablePorts,
            user_parameters: userParameters,
          },
        });

        setResult(blueprint);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    createBlueprint();
  }, [name, dockerfile, dockerfilePath, systemSetupCommands, resources, architecture, availablePorts, root, user]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Creating blueprint..." />}
      {result && (
        <SuccessMessage
          message="Blueprint created successfully"
          details={`ID: ${result.id}\nName: ${result.name}\nStatus: ${result.status}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to create blueprint" error={error} />
      )}
    </>
  );
};

export async function createBlueprint(options: CreateBlueprintOptions) {
  const executor = createExecutor({ output: options.outputFormat });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      
      // Read dockerfile from file if path is provided
      let dockerfileContents = options.dockerfile;
      if (options.dockerfilePath) {
        dockerfileContents = await readFile(options.dockerfilePath, "utf-8");
      }

      // Parse user parameters
      let userParameters = undefined;
      if (options.user && options.root) {
        throw new Error("Only one of --user or --root can be specified");
      } else if (options.user) {
        const [username, uid] = options.user.split(":");
        if (!username || !uid) {
          throw new Error("User must be in format 'username:uid'");
        }
        userParameters = { username, uid: parseInt(uid) };
      } else if (options.root) {
        userParameters = { username: "root", uid: 0 };
      }

      return client.blueprints.create({
        name: options.name,
        dockerfile: dockerfileContents,
        system_setup_commands: options.systemSetupCommands,
        launch_parameters: {
          resource_size_request: options.resources as any,
          architecture: options.architecture as any,
          available_ports: options.availablePorts,
          user_parameters: userParameters,
        },
      });
    },
    () => <CreateBlueprintUI 
      name={options.name}
      dockerfile={options.dockerfile}
      dockerfilePath={options.dockerfilePath}
      systemSetupCommands={options.systemSetupCommands}
      resources={options.resources}
      architecture={options.architecture}
      availablePorts={options.availablePorts}
      root={options.root}
      user={options.user}
    />,
  );
}

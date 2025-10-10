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

interface PreviewBlueprintOptions {
  name: string;
  dockerfile?: string;
  systemSetupCommands?: string[];
  output?: string;
}

const PreviewBlueprintUI: React.FC<{
  name: string;
  dockerfile?: string;
  systemSetupCommands?: string[];
}> = ({ name, dockerfile, systemSetupCommands }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const previewBlueprint = async () => {
      try {
        const client = getClient();
        const blueprint = await client.blueprints.preview({
          name,
          dockerfile,
          system_setup_commands: systemSetupCommands,
        });
        setResult(blueprint);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    previewBlueprint();
  }, [name, dockerfile, systemSetupCommands]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Previewing blueprint..." />}
      {result && (
        <SuccessMessage
          message="Blueprint preview generated"
          details={`Name: ${result.name}\nDockerfile: ${result.dockerfile ? "Present" : "Not provided"}\nSetup Commands: ${result.systemSetupCommands?.length || 0}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to preview blueprint" error={error} />
      )}
    </>
  );
};

export async function previewBlueprint(options: PreviewBlueprintOptions) {
  const executor = createExecutor({ output: options.output });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.blueprints.preview({
        name: options.name,
        dockerfile: options.dockerfile,
        system_setup_commands: options.systemSetupCommands,
      });
    },
    () => (
      <PreviewBlueprintUI
        name={options.name}
        dockerfile={options.dockerfile}
        systemSetupCommands={options.systemSetupCommands}
      />
    ),
  );
}

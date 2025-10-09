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

interface GetBlueprintOptions {
  id: string;
  output?: string;
}

const GetBlueprintUI: React.FC<{
  blueprintId: string;
}> = ({ blueprintId }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const getBlueprint = async () => {
      try {
        const client = getClient();
        const blueprint = await client.blueprints.retrieve(blueprintId);
        setResult(blueprint);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    getBlueprint();
  }, [blueprintId]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Fetching blueprint details..." />}
      {result && (
        <SuccessMessage
          message="Blueprint details retrieved"
          details={`ID: ${result.id}\nName: ${result.name}\nStatus: ${result.status}\nCreated: ${new Date(result.createdAt).toLocaleString()}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to get blueprint" error={error} />
      )}
    </>
  );
};

export async function getBlueprint(options: GetBlueprintOptions) {
  const executor = createExecutor({ output: options.output });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.blueprints.retrieve(options.id);
    },
    () => <GetBlueprintUI blueprintId={options.id} />,
  );
}

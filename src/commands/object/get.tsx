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

interface GetObjectOptions {
  id: string;
  outputFormat?: string;
}

const GetObjectUI: React.FC<{
  objectId: string;
}> = ({ objectId }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const getObject = async () => {
      try {
        const client = getClient();
        const object = await client.objects.retrieve(objectId);
        setResult(object);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    getObject();
  }, [objectId]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Fetching object details..." />}
      {result && (
        <SuccessMessage
          message="Object details retrieved"
          details={`ID: ${result.id}\nName: ${result.name}\nType: ${result.contentType}\nState: ${result.state}\nSize: ${result.sizeBytes ? `${result.sizeBytes} bytes` : "Unknown"}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to get object" error={error} />
      )}
    </>
  );
};

export async function getObject(options: GetObjectOptions) {
  const executor = createExecutor({ output: options.outputFormat });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.objects.retrieve(options.id);
    },
    () => <GetObjectUI objectId={options.id} />,
  );
}

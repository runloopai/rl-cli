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

interface DeleteObjectOptions {
  id: string;
  outputFormat?: string;
}

const DeleteObjectUI = ({ objectId }: { objectId: string }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const deleteObject = async () => {
      try {
        const client = getClient();
        const deletedObject = await client.objects.delete(objectId);
        setResult(deletedObject);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    deleteObject();
  }, [objectId]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Deleting object..." />}
      {result && (
        <SuccessMessage
          message="Object deleted successfully"
          details={`ID: ${result.id}\nName: ${result.name}\nThis action is irreversible`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to delete object" error={error} />
      )}
    </>
  );
};

export async function deleteObject(options: DeleteObjectOptions) {
  const executor = createExecutor({ output: options.outputFormat });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      return client.objects.delete(options.id);
    },
    () => <DeleteObjectUI objectId={options.id} />,
  );
}

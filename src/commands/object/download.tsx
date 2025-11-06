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

interface DownloadObjectOptions {
  id: string;
  path: string;
  extract?: boolean;
  durationSeconds?: number;
  outputFormat?: string;
}

const DownloadObjectUI = ({
  objectId,
  path,
  extract,
  durationSeconds,
}: {
  objectId: string;
  path: string;
  extract?: boolean;
  durationSeconds?: number;
}) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const downloadObject = async () => {
      try {
        const client = getClient();

        // Get the object metadata first
        const object = await client.objects.retrieve(objectId);

        // Get the download URL
        const downloadUrlResponse = await client.objects.download(objectId, {
          duration_seconds: durationSeconds || 3600,
        });

        // Download the file
        const response = await fetch(downloadUrlResponse.download_url);
        if (!response.ok) {
          throw new Error(`Download failed: HTTP ${response.status}`);
        }

        // Handle extraction if requested
        if (extract) {
          // For now, just save to the specified path
          // In a full implementation, you'd handle archive extraction here
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await import("fs/promises").then((fs) => fs.writeFile(path, buffer));
        } else {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          await import("fs/promises").then((fs) => fs.writeFile(path, buffer));
        }

        setResult({ objectId, path, extract });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    downloadObject();
  }, [objectId, path, extract, durationSeconds]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Downloading object..." />}
      {result && (
        <>
          <SuccessMessage message="Object downloaded successfully" />
          <Box marginLeft={2} flexDirection="column" marginTop={1}>
            <Box>
              <Text color={colors.textDim} dimColor>Object ID: </Text>
              <Text color={colors.idColor}>{result.objectId}</Text>
            </Box>
            <Box>
              <Text color={colors.textDim} dimColor>
                Path: {result.path}
              </Text>
            </Box>
            <Box>
              <Text color={colors.textDim} dimColor>
                Extracted: {result.extract ? "Yes" : "No"}
              </Text>
            </Box>
          </Box>
        </>
      )}
      {error && (
        <ErrorMessage message="Failed to download object" error={error} />
      )}
    </>
  );
};

export async function downloadObject(options: DownloadObjectOptions) {
  const executor = createExecutor({ output: options.outputFormat });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();

      // Get the object metadata first
      const object = await client.objects.retrieve(options.id);

      // Get the download URL
      const downloadUrlResponse = await client.objects.download(options.id, {
        duration_seconds: options.durationSeconds || 3600,
      });

      // Download the file
      const response = await fetch(downloadUrlResponse.download_url);
      if (!response.ok) {
        throw new Error(`Download failed: HTTP ${response.status}`);
      }

      // Handle extraction if requested
      if (options.extract) {
        // For now, just save to the specified path
        // In a full implementation, you'd handle archive extraction here
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await import("fs/promises").then((fs) =>
          fs.writeFile(options.path, buffer),
        );
      } else {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await import("fs/promises").then((fs) =>
          fs.writeFile(options.path, buffer),
        );
      }

      return {
        objectId: options.id,
        path: options.path,
        extract: options.extract,
      };
    },
    () => (
      <DownloadObjectUI
        objectId={options.id}
        path={options.path}
        extract={options.extract}
        durationSeconds={options.durationSeconds}
      />
    ),
  );
}

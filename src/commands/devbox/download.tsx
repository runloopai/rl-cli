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
import { writeFileSync } from "fs";

interface DownloadOptions {
  filePath: string;
  outputPath: string;
  outputFormat?: string;
}

const DownloadFileUI = ({
  devboxId,
  filePath,
  outputPath,
}: {
  devboxId: string;
  filePath: string;
  outputPath: string;
}) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const downloadFile = async () => {
      try {
        const client = getClient();
        const result = await client.devboxes.downloadFile(devboxId, {
          path: filePath,
        });
        // The result should contain the file contents, write them to the output path
        writeFileSync(outputPath, result as any);
        setResult({ filePath, outputPath });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    downloadFile();
  }, [devboxId, filePath, outputPath]);

  return (
    <>
      <Banner />
      {loading && (
        <SpinnerComponent message="Downloading file from devbox..." />
      )}
      {result && (
        <SuccessMessage
          message="File downloaded successfully"
          details={`Remote: ${result.filePath}\nLocal: ${result.outputPath}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to download file" error={error} />
      )}
    </>
  );
};

export async function downloadFile(devboxId: string, options: DownloadOptions) {
  const executor = createExecutor({ output: options.outputFormat });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      const result = await client.devboxes.downloadFile(devboxId, {
        path: options.filePath,
      });
      writeFileSync(options.outputPath, result as any);
      return {
        filePath: options.filePath,
        outputPath: options.outputPath,
      };
    },
    () => (
      <DownloadFileUI
        devboxId={devboxId}
        filePath={options.filePath}
        outputPath={options.outputPath}
      />
    ),
  );
}

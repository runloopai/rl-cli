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
import { writeFile } from "fs/promises";

interface ReadOptions {
  remote: string;
  outputPath?: string;
  output?: string;
}

const ReadFileUI: React.FC<{
  devboxId: string;
  remotePath: string;
  outputPath: string;
}> = ({ devboxId, remotePath, outputPath }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const readFile = async () => {
      try {
        const client = getClient();
        const contents = await client.devboxes.readFileContents(devboxId, { file_path: remotePath });
        await writeFile(outputPath, contents);
        setResult({ remotePath, outputPath, size: contents.length });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    readFile();
  }, [devboxId, remotePath, outputPath]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Reading file from devbox..." />}
      {result && (
        <SuccessMessage
          message="File read successfully"
          details={`Remote: ${result.remotePath}\nLocal: ${result.outputPath}\nSize: ${result.size} bytes`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to read file" error={error} />
      )}
    </>
  );
};

export async function readFile(devboxId: string, options: ReadOptions) {
  const executor = createExecutor({ output: options.output });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      const contents = await client.devboxes.readFileContents(devboxId, { file_path: options.remote });
      await writeFile(options.outputPath!, contents);
      return {
        remotePath: options.remote,
        outputPath: options.outputPath!,
        size: contents.length
      };
    },
    () => <ReadFileUI devboxId={devboxId} remotePath={options.remote} outputPath={options.outputPath!} />,
  );
}

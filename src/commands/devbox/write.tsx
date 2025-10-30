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

interface WriteOptions {
  input: string;
  remote: string;
  output?: string;
}

const WriteFileUI = ({
  devboxId,
  inputPath,
  remotePath,
}: {
  devboxId: string;
  inputPath: string;
  remotePath: string;
}) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const writeFile = async () => {
      try {
        const client = getClient();
        const contents = await readFile(inputPath, "utf-8");
        await client.devboxes.writeFileContents(devboxId, {
          file_path: remotePath,
          contents,
        });
        setResult({ inputPath, remotePath, size: contents.length });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    writeFile();
  }, [devboxId, inputPath, remotePath]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Writing file to devbox..." />}
      {result && (
        <SuccessMessage
          message="File written successfully"
          details={`Local: ${result.inputPath}\nRemote: ${result.remotePath}\nSize: ${result.size} bytes`}
        />
      )}
      {error && <ErrorMessage message="Failed to write file" error={error} />}
    </>
  );
};

export async function writeFile(devboxId: string, options: WriteOptions) {
  const executor = createExecutor({ output: options.output });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      const contents = await readFile(options.input, "utf-8");
      await client.devboxes.writeFileContents(devboxId, {
        file_path: options.remote,
        contents,
      });
      return {
        inputPath: options.input,
        remotePath: options.remote,
        size: contents.length,
      };
    },
    () => (
      <WriteFileUI
        devboxId={devboxId}
        inputPath={options.input}
        remotePath={options.remote}
      />
    ),
  );
}

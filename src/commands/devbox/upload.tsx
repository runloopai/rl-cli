import React from "react";
import { render } from "ink";
import { createReadStream } from "fs";
import { getClient } from "../../utils/client.js";
import { Header } from "../../components/Header.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { SuccessMessage } from "../../components/SuccessMessage.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";

interface UploadOptions {
  path?: string;
}

const UploadFileUI = ({
  id,
  file,
  targetPath,
}: {
  id: string;
  file: string;
  targetPath?: string;
}) => {
  const [loading, setLoading] = React.useState(true);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const upload = async () => {
      try {
        const client = getClient();
        const fileStream = createReadStream(file);
        const filename = file.split("/").pop() || "uploaded-file";

        await client.devboxes.uploadFile(id, {
          path: targetPath || filename,
          file: fileStream,
        });

        setSuccess(true);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    upload();
  }, []);

  return (
    <>
      <Header title="Upload File" subtitle={`Uploading to devbox: ${id}`} />
      {loading && <SpinnerComponent message="Uploading file..." />}
      {success && (
        <SuccessMessage
          message="File uploaded successfully!"
          details={`File: ${file}${targetPath ? `\nTarget: ${targetPath}` : ""}`}
        />
      )}
      {error && <ErrorMessage message="Failed to upload file" error={error} />}
    </>
  );
};

export async function uploadFile(
  id: string,
  file: string,
  options: UploadOptions,
) {
  const { waitUntilExit } = render(
    <UploadFileUI id={id} file={file} targetPath={options.path} />,
  );
  await waitUntilExit();
}

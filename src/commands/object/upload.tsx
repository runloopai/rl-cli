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
import { readFile, stat } from "fs/promises";
import { extname } from "path";

interface UploadObjectOptions {
  path: string;
  name: string;
  contentType?: string;
  output?: string;
}

const UploadObjectUI: React.FC<{
  path: string;
  name: string;
  contentType?: string;
}> = ({ path, name, contentType }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const uploadObject = async () => {
      try {
        const client = getClient();
        
        // Check if file exists
        const stats = await stat(path);
        const fileBuffer = await readFile(path);
        
        // Auto-detect content type if not provided
        let detectedContentType: "binary" | "text" | "unspecified" | "gzip" | "tar" | "tgz" = contentType as any;
        if (!detectedContentType) {
          const ext = extname(path).toLowerCase();
          const contentTypeMap: { [key: string]: "binary" | "text" | "unspecified" | "gzip" | "tar" | "tgz" } = {
            ".txt": "text",
            ".html": "text",
            ".css": "text",
            ".js": "text",
            ".json": "text",
            ".yaml": "text",
            ".yml": "text",
            ".md": "text",
            ".gz": "gzip",
            ".tar": "tar",
            ".tgz": "tgz",
            ".tar.gz": "tgz",
          };
          detectedContentType = contentTypeMap[ext] || "unspecified";
        }

        // Step 1: Create the object
        const createResponse = await client.objects.create({
          name,
          content_type: detectedContentType,
        });

        // Step 2: Upload the file
        const uploadResponse = await fetch(createResponse.upload_url!, {
          method: "PUT",
          body: fileBuffer,
          headers: {
            "Content-Length": fileBuffer.length.toString(),
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: HTTP ${uploadResponse.status}`);
        }

        // Step 3: Complete the upload
        await client.objects.complete(createResponse.id);

        setResult({ 
          id: createResponse.id, 
          name, 
          contentType: detectedContentType,
          size: stats.size 
        });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    uploadObject();
  }, [path, name, contentType]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Uploading object..." />}
      {result && (
        <SuccessMessage
          message="Object uploaded successfully"
          details={`ID: ${result.id}\nName: ${result.name}\nType: ${result.contentType}\nSize: ${result.size} bytes`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to upload object" error={error} />
      )}
    </>
  );
};

export async function uploadObject(options: UploadObjectOptions) {
  const executor = createExecutor({ output: options.output });

  await executor.executeAction(
    async () => {
      const client = executor.getClient();
      
      // Check if file exists
      const stats = await stat(options.path);
      const fileBuffer = await readFile(options.path);
      
      // Auto-detect content type if not provided
      let detectedContentType: "binary" | "text" | "unspecified" | "gzip" | "tar" | "tgz" = options.contentType as any;
      if (!detectedContentType) {
        const ext = extname(options.path).toLowerCase();
        const contentTypeMap: { [key: string]: "binary" | "text" | "unspecified" | "gzip" | "tar" | "tgz" } = {
          ".txt": "text",
          ".html": "text",
          ".css": "text",
          ".js": "text",
          ".json": "text",
          ".yaml": "text",
          ".yml": "text",
          ".md": "text",
          ".gz": "gzip",
          ".tar": "tar",
          ".tgz": "tgz",
          ".tar.gz": "tgz",
        };
        detectedContentType = contentTypeMap[ext] || "unspecified";
      }

      // Step 1: Create the object
      const createResponse = await client.objects.create({
        name: options.name,
        content_type: detectedContentType,
      });

      // Step 2: Upload the file
      const uploadResponse = await fetch(createResponse.upload_url!, {
        method: "PUT",
        body: fileBuffer,
        headers: {
          "Content-Length": fileBuffer.length.toString(),
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: HTTP ${uploadResponse.status}`);
      }

      // Step 3: Complete the upload
      await client.objects.complete(createResponse.id);

      return { 
        id: createResponse.id, 
        name: options.name, 
        contentType: detectedContentType,
        size: stats.size 
      };
    },
    () => <UploadObjectUI 
      path={options.path}
      name={options.name}
      contentType={options.contentType}
    />,
  );
}

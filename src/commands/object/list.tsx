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
import { Table } from "../../components/Table.js";

interface ListObjectsOptions {
  limit?: number;
  startingAfter?: string;
  name?: string;
  contentType?: string;
  state?: string;
  search?: string;
  public?: boolean;
  output?: string;
}

const ListObjectsUI: React.FC<{
  options: ListObjectsOptions;
}> = ({ options }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const listObjects = async () => {
      try {
        const client = getClient();
        const params: any = {};
        
        if (options.limit) params.limit = options.limit;
        if (options.startingAfter) params.startingAfter = options.startingAfter;
        if (options.name) params.name = options.name;
        if (options.contentType) params.contentType = options.contentType;
        if (options.state) params.state = options.state;
        if (options.search) params.search = options.search;
        if (options.public) params.isPublic = true;

        const objects = options.public 
          ? await client.objects.listPublic(params)
          : await client.objects.list(params);
        
        setResult(objects);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    listObjects();
  }, [options]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Fetching objects..." />}
      {result && (
        <Box flexDirection="column">
          <Text color={colors.primary}>Objects:</Text>
          {result.objects && result.objects.length > 0 ? (
            <Table
              data={result.objects}
              keyExtractor={(item: any) => item.id}
              columns={[
                { 
                  key: "id", 
                  label: "ID", 
                  width: 20, 
                  render: (row: any) => (
                    <Text color={colors.text}>{row.id}</Text>
                  )
                },
                { 
                  key: "name", 
                  label: "Name", 
                  width: 30, 
                  render: (row: any) => (
                    <Text color={colors.text}>{row.name}</Text>
                  )
                },
                { 
                  key: "type", 
                  label: "Type", 
                  width: 15, 
                  render: (row: any) => (
                    <Text color={colors.text}>{row.content_type}</Text>
                  )
                },
                { 
                  key: "state", 
                  label: "State", 
                  width: 15, 
                  render: (row: any) => (
                    <Text color={colors.text}>{row.state}</Text>
                  )
                },
                { 
                  key: "size", 
                  label: "Size", 
                  width: 10, 
                  render: (row: any) => (
                    <Text color={colors.text}>
                      {row.size_bytes ? formatSize(row.size_bytes) : "N/A"}
                    </Text>
                  )
                }
              ]}
            />
          ) : (
            <Text color={colors.textDim}>No objects found</Text>
          )}
        </Box>
      )}
      {error && (
        <ErrorMessage message="Failed to list objects" error={error} />
      )}
    </>
  );
};

export async function listObjects(options: ListObjectsOptions) {
  const executor = createExecutor({ output: options.output });

  await executor.executeList(
    async () => {
      const client = executor.getClient();
      const params: any = {};
      
      if (options.limit) params.limit = options.limit;
      if (options.startingAfter) params.startingAfter = options.startingAfter;
      if (options.name) params.name = options.name;
      if (options.contentType) params.contentType = options.contentType;
      if (options.state) params.state = options.state;
      if (options.search) params.search = options.search;
      if (options.public) params.isPublic = true;

      const objects = options.public 
        ? await client.objects.listPublic(params)
        : await client.objects.list(params);
      
      return objects.objects || [];
    },
    () => <ListObjectsUI options={options} />,
    options.limit || 20
  );
}

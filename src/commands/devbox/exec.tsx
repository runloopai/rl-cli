import React from "react";
import { render, Box, Text } from "ink";
import { getClient } from "../../utils/client.js";
import { Header } from "../../components/Header.js";
import { SpinnerComponent } from "../../components/Spinner.js";
import { ErrorMessage } from "../../components/ErrorMessage.js";
import { colors } from "../../utils/theme.js";

const ExecCommandUI: React.FC<{ id: string; command: string[] }> = ({
  id,
  command,
}) => {
  const [loading, setLoading] = React.useState(true);
  const [output, setOutput] = React.useState<string>("");
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const exec = async () => {
      try {
        const client = getClient();
        const result = await client.devboxes.executeSync(id, {
          command: command.join(" "),
        });
        setOutput(
          result.stdout || result.stderr || "Command executed successfully",
        );
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    exec();
  }, []);

  return (
    <>
      <Header title="Execute Command" subtitle={`Running in devbox: ${id}`} />
      {loading && <SpinnerComponent message="Executing command..." />}
      {!loading && !error && (
        <Box flexDirection="column" marginTop={1}>
          <Box borderStyle="round" borderColor={colors.success} padding={1}>
            <Text>{output}</Text>
          </Box>
        </Box>
      )}
      {error && (
        <ErrorMessage message="Failed to execute command" error={error} />
      )}
    </>
  );
};

export async function execCommand(id: string, command: string[]) {
  const { waitUntilExit } = render(<ExecCommandUI id={id} command={command} />);
  await waitUntilExit();
}

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
import {
  getSSHKey,
  waitForReady,
  generateSSHConfig,
  checkSSHTools,
} from "../../utils/ssh.js";

interface SSHOptions {
  configOnly?: boolean;
  noWait?: boolean;
  timeout?: number;
  pollInterval?: number;
  output?: string;
}

const SSHDevboxUI: React.FC<{
  devboxId: string;
  options: SSHOptions;
}> = ({ devboxId, options }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const connectSSH = async () => {
      try {
        // Check if SSH tools are available
        const sshToolsAvailable = await checkSSHTools();
        if (!sshToolsAvailable) {
          throw new Error(
            "SSH tools (ssh, scp, rsync, openssl) are not available on this system",
          );
        }

        const client = getClient();

        // Wait for devbox to be ready unless --no-wait is specified
        if (!options.noWait) {
          console.log(`Waiting for devbox ${devboxId} to be ready...`);
          const isReady = await waitForReady(
            devboxId,
            options.timeout || 180,
            options.pollInterval || 3,
          );
          if (!isReady) {
            throw new Error(
              `Devbox ${devboxId} is not ready. Please try again later.`,
            );
          }
        }

        // Get devbox details to determine user
        const devbox = await client.devboxes.retrieve(devboxId);
        const user =
          devbox.launch_parameters?.user_parameters?.username || "user";

        // Get SSH key
        const sshInfo = await getSSHKey(devboxId);
        if (!sshInfo) {
          throw new Error("Failed to create SSH key");
        }

        if (options.configOnly) {
          const config = generateSSHConfig(
            devboxId,
            user,
            sshInfo.keyfilePath,
            sshInfo.url,
          );
          setResult({ config });
        } else {
          setResult({
            devboxId,
            user,
            keyfilePath: sshInfo.keyfilePath,
            url: sshInfo.url,
          });
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    connectSSH();
  }, [devboxId, options]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Setting up SSH connection..." />}
      {result && result.config && (
        <Box flexDirection="column">
          <Text color={colors.primary}>SSH Config:</Text>
          <Text>{result.config}</Text>
        </Box>
      )}
      {result && !result.config && (
        <SuccessMessage
          message="SSH connection ready"
          details={`Devbox: ${result.devboxId}\nUser: ${result.user}\nKey: ${result.keyfilePath}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to setup SSH connection" error={error} />
      )}
    </>
  );
};

export async function sshDevbox(devboxId: string, options: SSHOptions) {
  const executor = createExecutor(options);

  await executor.executeAction(
    async () => {
      // Check if SSH tools are available
      const sshToolsAvailable = await checkSSHTools();
      if (!sshToolsAvailable) {
        throw new Error(
          "SSH tools (ssh, scp, rsync, openssl) are not available on this system",
        );
      }

      const client = executor.getClient();

      // Wait for devbox to be ready unless --no-wait is specified
      if (!options.noWait) {
        console.log(`Waiting for devbox ${devboxId} to be ready...`);
        const isReady = await waitForReady(
          devboxId,
          options.timeout || 180,
          options.pollInterval || 3,
        );
        if (!isReady) {
          throw new Error(
            `Devbox ${devboxId} is not ready. Please try again later.`,
          );
        }
      }

      // Get devbox details to determine user
      const devbox = await client.devboxes.retrieve(devboxId);
      const user =
        devbox.launch_parameters?.user_parameters?.username || "user";

      // Get SSH key
      const sshInfo = await getSSHKey(devboxId);
      if (!sshInfo) {
        throw new Error("Failed to create SSH key");
      }

      if (options.configOnly) {
        return {
          config: generateSSHConfig(
            devboxId,
            user,
            sshInfo.keyfilePath,
            sshInfo.url,
          ),
        };
      } else {
        return {
          devboxId,
          user,
          keyfilePath: sshInfo.keyfilePath,
          url: sshInfo.url,
        };
      }
    },
    () => <SSHDevboxUI devboxId={devboxId} options={options} />,
  );
}

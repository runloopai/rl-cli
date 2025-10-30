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
import { getSSHKey, getProxyCommand, checkSSHTools } from "../../utils/ssh.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface RsyncOptions {
  src: string;
  dst: string;
  rsyncOptions?: string;
  outputFormat?: string;
}

const RsyncUI = ({
  devboxId,
  src,
  dst,
  rsyncOptions,
}: {
  devboxId: string;
  src: string;
  dst: string;
  rsyncOptions?: string;
}) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const performRsync = async () => {
      try {
        // Check if SSH tools are available
        const sshToolsAvailable = await checkSSHTools();
        if (!sshToolsAvailable) {
          throw new Error(
            "SSH tools (ssh, rsync, openssl) are not available on this system",
          );
        }

        const client = getClient();

        // Get devbox details to determine user
        const devbox = await client.devboxes.retrieve(devboxId);
        const user =
          devbox.launch_parameters?.user_parameters?.username || "user";

        // Get SSH key
        const sshInfo = await getSSHKey(devboxId);
        if (!sshInfo) {
          throw new Error("Failed to create SSH key");
        }

        const proxyCommand = getProxyCommand();
        const sshOptions = `-i ${sshInfo.keyfilePath} -o ProxyCommand='${proxyCommand}' -o StrictHostKeyChecking=no`;

        const rsyncCommand = [
          "rsync",
          "-vrz", // v: verbose, r: recursive, z: compress
          "-e",
          `ssh ${sshOptions}`,
        ];

        if (rsyncOptions) {
          rsyncCommand.push(...rsyncOptions.split(" "));
        }

        // Handle remote paths (starting with :)
        if (src.startsWith(":")) {
          rsyncCommand.push(`${user}@${sshInfo.url}:${src.slice(1)}`);
          rsyncCommand.push(dst);
        } else {
          rsyncCommand.push(src);
          if (dst.startsWith(":")) {
            rsyncCommand.push(`${user}@${sshInfo.url}:${dst.slice(1)}`);
          } else {
            rsyncCommand.push(dst);
          }
        }

        const { stdout, stderr } = await execAsync(rsyncCommand.join(" "));
        setResult({ src, dst, stdout, stderr });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    performRsync();
  }, [devboxId, src, dst, rsyncOptions]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Syncing files with rsync..." />}
      {result && (
        <SuccessMessage
          message="Rsync operation completed"
          details={`Source: ${result.src}\nDestination: ${result.dst}`}
        />
      )}
      {error && <ErrorMessage message="Rsync operation failed" error={error} />}
    </>
  );
};

export async function rsyncFiles(devboxId: string, options: RsyncOptions) {
  const executor = createExecutor({ output: options.outputFormat });

  await executor.executeAction(
    async () => {
      // Check if SSH tools are available
      const sshToolsAvailable = await checkSSHTools();
      if (!sshToolsAvailable) {
        throw new Error(
          "SSH tools (ssh, rsync, openssl) are not available on this system",
        );
      }

      const client = executor.getClient();

      // Get devbox details to determine user
      const devbox = await client.devboxes.retrieve(devboxId);
      const user =
        devbox.launch_parameters?.user_parameters?.username || "user";

      // Get SSH key
      const sshInfo = await getSSHKey(devboxId);
      if (!sshInfo) {
        throw new Error("Failed to create SSH key");
      }

      const proxyCommand = getProxyCommand();
      const sshOptions = `-i ${sshInfo.keyfilePath} -o ProxyCommand='${proxyCommand}' -o StrictHostKeyChecking=no`;

      const rsyncCommand = [
        "rsync",
        "-vrz", // v: verbose, r: recursive, z: compress
        "-e",
        `ssh ${sshOptions}`,
      ];

      if (options.rsyncOptions) {
        rsyncCommand.push(...options.rsyncOptions.split(" "));
      }

      // Handle remote paths (starting with :)
      if (options.src.startsWith(":")) {
        rsyncCommand.push(`${user}@${sshInfo.url}:${options.src.slice(1)}`);
        rsyncCommand.push(options.dst);
      } else {
        rsyncCommand.push(options.src);
        if (options.dst.startsWith(":")) {
          rsyncCommand.push(`${user}@${sshInfo.url}:${options.dst.slice(1)}`);
        } else {
          rsyncCommand.push(options.dst);
        }
      }

      const { stdout, stderr } = await execAsync(rsyncCommand.join(" "));
      return { src: options.src, dst: options.dst, stdout, stderr };
    },
    () => (
      <RsyncUI
        devboxId={devboxId}
        src={options.src}
        dst={options.dst}
        rsyncOptions={options.rsyncOptions}
      />
    ),
  );
}

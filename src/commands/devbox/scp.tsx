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

interface SCPOptions {
  src: string;
  dst: string;
  scpOptions?: string;
  outputFormat?: string;
}

const SCPUI: React.FC<{
  devboxId: string;
  src: string;
  dst: string;
  scpOptions?: string;
}> = ({ devboxId, src, dst, scpOptions }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const performSCP = async () => {
      try {
        // Check if SSH tools are available
        const sshToolsAvailable = await checkSSHTools();
        if (!sshToolsAvailable) {
          throw new Error("SSH tools (ssh, scp, openssl) are not available on this system");
        }

        const client = getClient();
        
        // Get devbox details to determine user
        const devbox = await client.devboxes.retrieve(devboxId);
        const user = devbox.launch_parameters?.user_parameters?.username || "user";

        // Get SSH key
        const sshInfo = await getSSHKey(devboxId);
        if (!sshInfo) {
          throw new Error("Failed to create SSH key");
        }

        const proxyCommand = getProxyCommand();
        const scpCommand = [
          "scp",
          "-i",
          sshInfo.keyfilePath,
          "-o",
          `ProxyCommand=${proxyCommand}`,
          "-o",
          "StrictHostKeyChecking=no",
        ];

        if (scpOptions) {
          scpCommand.push(...scpOptions.split(" "));
        }

        // Handle remote paths (starting with :)
        if (src.startsWith(":")) {
          scpCommand.push(`${user}@${sshInfo.url}:${src.slice(1)}`);
          scpCommand.push(dst);
        } else {
          scpCommand.push(src);
          if (dst.startsWith(":")) {
            scpCommand.push(`${user}@${sshInfo.url}:${dst.slice(1)}`);
          } else {
            scpCommand.push(dst);
          }
        }

        const { stdout, stderr } = await execAsync(scpCommand.join(" "));
        setResult({ src, dst, stdout, stderr });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    performSCP();
  }, [devboxId, src, dst, scpOptions]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Copying files with SCP..." />}
      {result && (
        <SuccessMessage
          message="SCP operation completed"
          details={`Source: ${result.src}\nDestination: ${result.dst}`}
        />
      )}
      {error && (
        <ErrorMessage message="SCP operation failed" error={error} />
      )}
    </>
  );
};

export async function scpFiles(devboxId: string, options: SCPOptions) {
  const executor = createExecutor({ output: options.outputFormat });

  await executor.executeAction(
    async () => {
      // Check if SSH tools are available
      const sshToolsAvailable = await checkSSHTools();
      if (!sshToolsAvailable) {
        throw new Error("SSH tools (ssh, scp, openssl) are not available on this system");
      }

      const client = executor.getClient();
      
      // Get devbox details to determine user
      const devbox = await client.devboxes.retrieve(devboxId);
        const user = devbox.launch_parameters?.user_parameters?.username || "user";

      // Get SSH key
      const sshInfo = await getSSHKey(devboxId);
      if (!sshInfo) {
        throw new Error("Failed to create SSH key");
      }

      const proxyCommand = getProxyCommand();
      const scpCommand = [
        "scp",
        "-i",
        sshInfo.keyfilePath,
        "-o",
        `ProxyCommand=${proxyCommand}`,
        "-o",
        "StrictHostKeyChecking=no",
      ];

      if (options.scpOptions) {
        scpCommand.push(...options.scpOptions.split(" "));
      }

      // Handle remote paths (starting with :)
      if (options.src.startsWith(":")) {
        scpCommand.push(`${user}@${sshInfo.url}:${options.src.slice(1)}`);
        scpCommand.push(options.dst);
      } else {
        scpCommand.push(options.src);
        if (options.dst.startsWith(":")) {
          scpCommand.push(`${user}@${sshInfo.url}:${options.dst.slice(1)}`);
        } else {
          scpCommand.push(options.dst);
        }
      }

      const { stdout, stderr } = await execAsync(scpCommand.join(" "));
      return { src: options.src, dst: options.dst, stdout, stderr };
    },
    () => <SCPUI devboxId={devboxId} src={options.src} dst={options.dst} scpOptions={options.scpOptions} />,
  );
}

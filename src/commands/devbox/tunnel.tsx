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

interface TunnelOptions {
  ports: string;
  outputFormat?: string;
}

const TunnelUI: React.FC<{
  devboxId: string;
  ports: string;
}> = ({ devboxId, ports }) => {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const createTunnel = async () => {
      try {
        // Check if SSH tools are available
        const sshToolsAvailable = await checkSSHTools();
        if (!sshToolsAvailable) {
          throw new Error("SSH tools (ssh, openssl) are not available on this system");
        }

        if (!ports.includes(":")) {
          throw new Error("Ports must be specified as 'local:remote'");
        }

        const [localPort, remotePort] = ports.split(":");

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
        const tunnelCommand = [
          "/usr/bin/ssh",
          "-i",
          sshInfo.keyfilePath,
          "-o",
          `ProxyCommand=${proxyCommand}`,
          "-o",
          "StrictHostKeyChecking=no",
          "-N", // Do not execute a remote command
          "-L",
          `${localPort}:localhost:${remotePort}`,
          `${user}@${sshInfo.url}`,
        ];

        console.log(`Starting tunnel: local port ${localPort} -> remote port ${remotePort}`);
        console.log("Press Ctrl+C to stop the tunnel.");

        // Set up signal handler for graceful shutdown
        const signalHandler = () => {
          console.log("\nStopping tunnel...");
          process.exit(0);
        };
        process.on("SIGINT", signalHandler);

        const { stdout, stderr } = await execAsync(tunnelCommand.join(" "));
        setResult({ localPort, remotePort, stdout, stderr });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    createTunnel();
  }, [devboxId, ports]);

  return (
    <>
      <Banner />
      {loading && <SpinnerComponent message="Creating SSH tunnel..." />}
      {result && (
        <SuccessMessage
          message="SSH tunnel created"
          details={`Local port: ${result.localPort}\nRemote port: ${result.remotePort}`}
        />
      )}
      {error && (
        <ErrorMessage message="Failed to create SSH tunnel" error={error} />
      )}
    </>
  );
};

export async function createTunnel(devboxId: string, options: TunnelOptions) {
  const executor = createExecutor({ output: options.outputFormat });

  await executor.executeAction(
    async () => {
      // Check if SSH tools are available
      const sshToolsAvailable = await checkSSHTools();
      if (!sshToolsAvailable) {
        throw new Error("SSH tools (ssh, openssl) are not available on this system");
      }

      if (!options.ports.includes(":")) {
        throw new Error("Ports must be specified as 'local:remote'");
      }

      const [localPort, remotePort] = options.ports.split(":");

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
      const tunnelCommand = [
        "/usr/bin/ssh",
        "-i",
        sshInfo.keyfilePath,
        "-o",
        `ProxyCommand=${proxyCommand}`,
        "-o",
        "StrictHostKeyChecking=no",
        "-N", // Do not execute a remote command
        "-L",
        `${localPort}:localhost:${remotePort}`,
        `${user}@${sshInfo.url}`,
      ];

      console.log(`Starting tunnel: local port ${localPort} -> remote port ${remotePort}`);
      console.log("Press Ctrl+C to stop the tunnel.");

      // Set up signal handler for graceful shutdown
      const signalHandler = () => {
        console.log("\nStopping tunnel...");
        process.exit(0);
      };
      process.on("SIGINT", signalHandler);

      const { stdout, stderr } = await execAsync(tunnelCommand.join(" "));
      return { localPort, remotePort, stdout, stderr };
    },
    () => <TunnelUI devboxId={devboxId} ports={options.ports} />,
  );
}

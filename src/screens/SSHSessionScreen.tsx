/**
 * SSHSessionScreen - SSH session using custom InteractiveSpawn
 * Runs SSH as a subprocess within the Ink UI without exiting
 */
import React from "react";
import { Box, Text } from "ink";
import { InteractiveSpawn } from "../components/InteractiveSpawn.js";
import {
  useNavigation,
  type ScreenName,
  type RouteParams,
} from "../store/navigationStore.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { colors } from "../utils/theme.js";
import figures from "figures";

export function SSHSessionScreen() {
  const { params, replace } = useNavigation();

  // NOTE: Do NOT use useExitOnCtrlC here - SSH handles Ctrl+C itself
  // Using useInput would conflict with the subprocess's terminal control

  // Extract SSH config from params
  const keyPath = params.keyPath;
  const proxyCommand = params.proxyCommand;
  const sshUser = params.sshUser;
  const url = params.url;
  const devboxName = params.devboxName || params.devboxId || "devbox";
  const returnScreen = (params.returnScreen as ScreenName) || "devbox-list";
  const returnParams = (params.returnParams as RouteParams) || {};

  // Validate required params
  if (!keyPath || !proxyCommand || !sshUser || !url) {
    return (
      <>
        <Breadcrumb items={[{ label: "SSH Session", active: true }]} />
        <Box flexDirection="column" paddingX={1}>
          <Text color={colors.error}>
            {figures.cross} Missing SSH configuration. Returning...
          </Text>
        </Box>
      </>
    );
  }

  // Build SSH command args
  // The proxy command needs to be passed as a single value in the -o option
  const sshArgs = React.useMemo(
    () => [
      "-t", // Force pseudo-terminal allocation for proper input handling
      "-i",
      keyPath!,
      "-o",
      `ProxyCommand=${proxyCommand}`,
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      "UserKnownHostsFile=/dev/null",
      `${sshUser}@${url}`,
    ],
    [keyPath, proxyCommand, sshUser, url],
  );

  return (
    <>
      <Breadcrumb items={[{ label: "SSH Session", active: true }]} />
      <Box flexDirection="column" paddingX={1} marginBottom={1}>
        <Text color={colors.primary} bold>
          {figures.play} Connecting to {devboxName}...
        </Text>
        <Text color={colors.textDim} dimColor>
          Press Ctrl+C or type exit to disconnect
        </Text>
      </Box>
      <InteractiveSpawn
        command="ssh"
        args={sshArgs}
        onExit={(_code) => {
          // Replace current screen (don't add SSH to history stack)
          // Using replace() instead of navigate() prevents "escape goes back to SSH" bug
          setTimeout(() => {
            replace(returnScreen, returnParams || {});
          }, 100);
        }}
        onError={(_error) => {
          // On error, replace current screen as well
          setTimeout(() => {
            replace(returnScreen, returnParams || {});
          }, 100);
        }}
      />
    </>
  );
}

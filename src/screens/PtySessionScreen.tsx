import React from "react";
import { Box, Text } from "ink";
import { InteractivePty } from "../components/InteractivePty.js";
import {
  useNavigation,
  type ScreenName,
  type RouteParams,
} from "../store/navigationStore.js";
import { Breadcrumb } from "../components/Breadcrumb.js";
import { colors } from "../utils/theme.js";
import figures from "figures";

export function PtySessionScreen() {
  const { params, replace } = useNavigation();

  const baseUrl = params.ptyBaseUrl;
  const sessionName = params.ptySessionName || params.devboxId;
  const authToken = params.ptyAuthToken;
  const devboxName = params.devboxName || params.devboxId || "devbox";
  const returnScreen = (params.returnScreen as ScreenName) || "devbox-list";
  const returnParams = (params.returnParams as RouteParams) || {};

  if (!baseUrl || !sessionName) {
    return (
      <>
        <Breadcrumb items={[{ label: "PTY Session", active: true }]} />
        <Box flexDirection="column" paddingX={1}>
          <Text color={colors.error}>
            {figures.cross} Missing PTY configuration. Returning...
          </Text>
        </Box>
      </>
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: "PTY Session", active: true }]} />
      <Box flexDirection="column" paddingX={1} marginBottom={1}>
        <Text color={colors.primary} bold>
          {figures.play} Connecting to {devboxName}...
        </Text>
        <Text color={colors.textDim} dimColor>
          Press Ctrl+D or type exit to disconnect
        </Text>
      </Box>
      <InteractivePty
        baseUrl={baseUrl}
        sessionName={sessionName}
        authToken={authToken}
        onExit={(_code) => {
          setTimeout(() => {
            replace(returnScreen, returnParams || {});
          }, 100);
        }}
        onError={(_error) => {
          setTimeout(() => {
            replace(returnScreen, returnParams || {});
          }, 100);
        }}
      />
    </>
  );
}

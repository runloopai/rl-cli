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

  const devboxId = params.devboxId;
  const sessionName = params.ptySessionName || params.devboxId;
  const devboxName = params.devboxName || params.devboxId || "devbox";
  const returnScreen: ScreenName =
    (params.returnScreen as ScreenName) || "devbox-list";

  // Stabilize returnParams across renders — the inline `|| {}` would otherwise
  // produce a fresh object every render and re-fire any effect depending on it.
  const returnParamsRaw = params.returnParams as RouteParams | undefined;
  const returnParams = React.useMemo(
    () => returnParamsRaw ?? {},
    [returnParamsRaw],
  );

  const goBack = React.useCallback(() => {
    replace(returnScreen, returnParams);
  }, [replace, returnScreen, returnParams]);

  const configOk = !!(devboxId && sessionName);
  React.useEffect(() => {
    if (!configOk) goBack();
  }, [configOk, goBack]);

  if (!devboxId || !sessionName) {
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
        devboxId={devboxId}
        sessionName={sessionName}
        onExit={goBack}
        onError={goBack}
      />
    </>
  );
}

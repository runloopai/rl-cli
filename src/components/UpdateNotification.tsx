import React from "react";
import { Box, Text } from "ink";
import { colors } from "../utils/theme.js";
import { VERSION } from "../version.js";

/**
 * Version check component that checks npm for updates and displays a notification
 * Restored from git history and enhanced with better visual styling
 */
export const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = React.useState<string | null>(
    null,
  );
  const [isChecking, setIsChecking] = React.useState(true);

  React.useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const currentVersion = VERSION;
        const response = await fetch(
          "https://registry.npmjs.org/@runloop/rl-cli/latest",
        );

        if (response.ok) {
          const data = (await response.json()) as { version: string };
          const latestVersion = data.version;

          if (latestVersion && latestVersion !== currentVersion) {
            // Check if current version is older than latest
            const compareVersions = (
              version1: string,
              version2: string,
            ): number => {
              const v1parts = version1.split(".").map(Number);
              const v2parts = version2.split(".").map(Number);

              for (
                let i = 0;
                i < Math.max(v1parts.length, v2parts.length);
                i++
              ) {
                const v1part = v1parts[i] || 0;
                const v2part = v2parts[i] || 0;

                if (v1part > v2part) return 1;
                if (v1part < v2part) return -1;
              }

              return 0;
            };

            const isUpdateAvailable =
              compareVersions(latestVersion, currentVersion) > 0;

            if (isUpdateAvailable) {
              setUpdateAvailable(latestVersion);
            }
          }
        }
      } catch {
        // Silently fail
      } finally {
        setIsChecking(false);
      }
    };

    checkForUpdates();
  }, []);

  if (isChecking || !updateAvailable) {
    return null;
  }

  return (
    <Box
      borderStyle="round"
      borderColor={colors.warning}
      paddingX={1}
      paddingY={0}
      marginTop={0}
    >
      <Text color={colors.warning} bold>
        ✨
      </Text>
      <Text color={colors.text} bold>
        {" "}
        Update available:{" "}
      </Text>
      <Text color={colors.warning} bold>
        {VERSION}
      </Text>
      <Text color={colors.primary} bold>
        {" "}
        →{" "}
      </Text>
      <Text color={colors.success} bold>
        {updateAvailable}
      </Text>
      <Text color={colors.text} bold>
        {" "}
        • Run:{" "}
      </Text>
      <Text color={colors.primary} bold>
        npm install -g @runloop/rl-cli@latest
      </Text>
    </Box>
  );
};

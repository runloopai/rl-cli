import React from "react";
import { VERSION } from "../version.js";

interface UpdateCheckResult {
  isChecking: boolean;
  updateAvailable: string | null;
  currentVersion: string;
}

/**
 * Hook to check for CLI updates from npm registry
 * Returns the latest version if an update is available
 */
export function useUpdateCheck(): UpdateCheckResult {
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

  return {
    isChecking,
    updateAvailable,
    currentVersion: VERSION,
  };
}

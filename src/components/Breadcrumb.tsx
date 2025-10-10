import React from "react";
import { Box, Text } from "ink";
import { colors } from "../utils/theme.js";
import { VERSION } from "../cli.js";

export interface BreadcrumbItem {
  label: string;
  active?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showVersionCheck?: boolean;
}

// Version check component
const VersionCheck: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = React.useState<string | null>(null);
  const [isChecking, setIsChecking] = React.useState(true);

  React.useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const currentVersion = process.env.npm_package_version || "0.0.1";
        const response = await fetch("https://registry.npmjs.org/@runloop/rl-cli/latest");
        
        if (response.ok) {
          const data = await response.json() as { version: string };
          const latestVersion = data.version;
          
          if (latestVersion && latestVersion !== currentVersion) {
            // Check if current version is older than latest
            const compareVersions = (version1: string, version2: string): number => {
              const v1parts = version1.split('.').map(Number);
              const v2parts = version2.split('.').map(Number);
              
              for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
                const v1part = v1parts[i] || 0;
                const v2part = v2parts[i] || 0;
                
                if (v1part > v2part) return 1;
                if (v1part < v2part) return -1;
              }
              
              return 0;
            };
            
            const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0;
            
            if (isUpdateAvailable) {
              setUpdateAvailable(latestVersion);
            }
          }
        }
      } catch (error) {
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
    <Box>
      <Text color={colors.primary} bold>
        ✨
      </Text>
      <Text color={colors.text} bold>
        {" "}Update available:{" "}
      </Text>
      <Text color={colors.textDim} dimColor>
        {VERSION}
      </Text>
      <Text color={colors.primary} bold>
        {" "}→{" "}
      </Text>
      <Text color={colors.success} bold>
        {updateAvailable}
      </Text>
      <Text color={colors.textDim} dimColor>
        {" "}• Run:{" "}
      </Text>
      <Text color={colors.primary} bold>
        npm install -g @runloop/rl-cli@latest
      </Text>
    </Box>
  );
};

export const Breadcrumb: React.FC<BreadcrumbProps> = React.memo(({ items, showVersionCheck = false }) => {
  const env = process.env.RUNLOOP_ENV?.toLowerCase();
  const isDevEnvironment = env === "dev";

  return (
    <Box marginBottom={1} paddingX={1} paddingY={0} flexDirection="column">
      <Box
        borderStyle="round"
        borderColor={colors.primary}
        paddingX={2}
        paddingY={0}
      >
        <Text color={colors.primary} bold>
          rl
        </Text>
        {isDevEnvironment && (
          <Text color="redBright" bold>
            {" "}
            (dev)
          </Text>
        )}
        <Text color={colors.textDim} dimColor>
          {" "}
          ›{" "}
        </Text>
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <Text
              color={item.active ? colors.text : colors.textDim}
              bold={item.active}
              dimColor={!item.active}
            >
              {item.label}
            </Text>
            {index < items.length - 1 && (
              <Text color={colors.textDim} dimColor>
                {" "}
                ›{" "}
              </Text>
            )}
          </React.Fragment>
        ))}
      </Box>
      {showVersionCheck && (
        <Box paddingX={2} marginTop={0}>
          <VersionCheck />
        </Box>
      )}
    </Box>
  );
});

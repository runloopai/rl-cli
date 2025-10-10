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
        // Import the utility functions from config
        const { checkForUpdates: checkForUpdatesUtil } = await import("../utils/config.js");
        
        // Use the same logic as the non-interactive version
        // We'll call the utility function and capture its output
        const originalConsoleError = console.error;
        let updateMessage = "";
        
        // Capture the console.error output
        console.error = (...args: any[]) => {
          updateMessage = args.join(' ');
          originalConsoleError(...args);
        };
        
        // Call the update check utility
        await checkForUpdatesUtil(false);
        
        // Restore original console.error
        console.error = originalConsoleError;
        
        // Parse the update message to extract the latest version
        if (updateMessage.includes("Update available:")) {
          const match = updateMessage.match(/Update available: .+ → (.+)/);
          if (match && match[1]) {
            setUpdateAvailable(match[1]);
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

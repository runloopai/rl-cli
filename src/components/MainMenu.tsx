import React from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import figures from "figures";
import { Banner } from "./Banner.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { VERSION } from "../version.js";
import { colors } from "../utils/theme.js";
import { execCommand } from "../utils/exec.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { useUpdateCheck } from "../hooks/useUpdateCheck.js";
import { useBetaFeatures } from "../store/betaFeatureStore.js";
import type { BetaFeature } from "../store/betaFeatureStore.js";

interface MenuItem {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  /** If set, this item is only shown when the specified beta feature is enabled */
  betaFeature?: BetaFeature;
}

const allMenuItems: MenuItem[] = [
  {
    key: "devboxes",
    label: "Devboxes",
    description: "Manage cloud development environments",
    icon: "◉",
    color: colors.accent1,
  },
  {
    key: "blueprints",
    label: "Blueprints",
    description: "Create and manage devbox templates",
    icon: "▣",
    color: colors.accent2,
  },
  {
    key: "snapshots",
    label: "Snapshots",
    description: "Save and restore devbox states",
    icon: "◈",
    color: colors.accent3,
  },
  {
    key: "objects",
    label: "Storage Objects",
    description: "Manage files and data in cloud storage",
    icon: "▤",
    color: colors.secondary,
  },
  {
    key: "benchmarks",
    label: "Benchmarks",
    description: "Performance testing and evaluation",
    icon: "▶",
    color: colors.success,
    betaFeature: "benchmarks",
  },
  {
    key: "settings",
    label: "Settings",
    description: "Network policies, secrets, and more",
    icon: "⚙",
    color: colors.info,
  },
];

interface MainMenuProps {
  onSelect: (key: string) => void;
}

// Layout modes based on terminal height
// Account for: breadcrumb (1) + banner (~6) + tagline (2) + header (2) + menu items (10) + nav tips (2) + padding = ~25 lines
// Use generous thresholds so compact modes trigger more readily
type LayoutMode = "full" | "medium" | "compact" | "minimal";

function getLayoutMode(height: number): LayoutMode {
  if (height >= 40) return "full"; // Big banner + bordered items + descriptions
  if (height >= 22) return "medium"; // Small banner + simple items + descriptions
  if (height >= 15) return "compact"; // No banner + simple items + short descriptions
  return "minimal"; // No banner + labels only
}

// Helper component for rendering beta badge
const BetaBadge = () => (
  <Text color={colors.warning} bold>
    {" "}
    [BETA]
  </Text>
);

export const MainMenu = ({ onSelect }: MainMenuProps) => {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const { stdout } = useStdout();
  const { isFeatureEnabled } = useBetaFeatures();

  // Filter menu items based on beta feature flags
  const menuItems = React.useMemo(() => {
    return allMenuItems.filter((item) => {
      if (item.betaFeature) {
        return isFeatureEnabled(item.betaFeature);
      }
      return true;
    });
  }, [isFeatureEnabled]);

  // Get raw terminal dimensions, responding to resize events
  // Default to 20 rows / 80 cols if we can't detect
  const getTerminalDimensions = React.useCallback(() => {
    return {
      height: stdout?.rows && stdout.rows > 0 ? stdout.rows : 20,
      width: stdout?.columns && stdout.columns > 0 ? stdout.columns : 80,
    };
  }, [stdout]);

  const [terminalDimensions, setTerminalDimensions] = React.useState(
    getTerminalDimensions,
  );

  React.useEffect(() => {
    // Update immediately on mount and when stdout changes
    setTerminalDimensions(getTerminalDimensions());

    if (!stdout) return;

    const handleResize = () => {
      setTerminalDimensions(getTerminalDimensions());
    };

    stdout.on("resize", handleResize);

    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout, getTerminalDimensions]);

  const terminalHeight = terminalDimensions.height;
  const terminalWidth = terminalDimensions.width;
  const isNarrow = terminalWidth < 70;

  // Check for updates
  const { updateAvailable } = useUpdateCheck();

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  // Helper to select menu item by key (if available in filtered list)
  const selectByKey = React.useCallback(
    (key: string) => {
      if (menuItems.some((item) => item.key === key)) {
        onSelect(key);
      }
    },
    [menuItems, onSelect],
  );

  // Helper to select menu item by number (1-indexed, based on filtered list)
  const selectByNumber = React.useCallback(
    (num: number) => {
      const index = num - 1;
      if (index >= 0 && index < menuItems.length) {
        onSelect(menuItems[index].key);
      }
    },
    [menuItems, onSelect],
  );

  useInput((input, key) => {
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < menuItems.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (key.return) {
      onSelect(menuItems[selectedIndex].key);
    } else if (key.escape) {
      exit();
    } else if (input === "d") {
      selectByKey("devboxes");
    } else if (input === "b") {
      selectByKey("blueprints");
    } else if (input === "s") {
      selectByKey("snapshots");
    } else if (input === "o") {
      selectByKey("objects");
    } else if (input === "e") {
      selectByKey("benchmarks");
    } else if (input === "n") {
      selectByKey("settings");
    } else if (input >= "1" && input <= "9") {
      selectByNumber(parseInt(input, 10));
    } else if (input === "u" && updateAvailable) {
      // Release terminal and exec into update command (never returns)
      execCommand("sh", [
        "-c",
        "npm install -g @runloop/rl-cli@latest && exec rli",
      ]);
    }
  });

  const layoutMode = getLayoutMode(terminalHeight);

  // Navigation tips for all layouts
  const quickSelectRange = `1-${menuItems.length}`;
  const navTips = (
    <NavigationTips
      showArrows
      paddingX={2}
      tips={[
        { key: quickSelectRange, label: "Quick select" },
        { key: "Enter", label: "Select" },
        { key: "Esc", label: "Quit" },
        { key: "u", label: "Update", condition: !!updateAvailable },
      ]}
    />
  );

  // Minimal layout - just the essentials
  if (layoutMode === "minimal") {
    return (
      <Box flexDirection="column">
        <Box paddingX={2}>
          <Text color={colors.primary} bold>
            RUNLOOP
          </Text>
          <Text color={colors.textDim} dimColor>
            {" "}
            v{VERSION}
          </Text>
        </Box>
        <Box flexDirection="column" paddingX={2}>
          {menuItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box key={item.key}>
                <Text color={isSelected ? item.color : colors.textDim}>
                  {isSelected ? figures.pointer : " "}
                </Text>
                <Text color={item.color}> {item.icon} </Text>
                <Text
                  color={isSelected ? item.color : colors.text}
                  bold={isSelected}
                >
                  {item.label}
                </Text>
                {item.betaFeature && <BetaBadge />}
                <Text color={colors.textDim} dimColor>
                  {" "}
                  [{index + 1}]
                </Text>
              </Box>
            );
          })}
        </Box>
        {navTips}
      </Box>
    );
  }

  // Compact layout - no banner, simple items with descriptions (or no descriptions if narrow)
  if (layoutMode === "compact") {
    return (
      <Box flexDirection="column">
        <Breadcrumb
          items={[{ label: "Home", active: true }]}
          showVersionCheck={true}
        />
        <Box paddingX={2}>
          <Text color={colors.primary} bold>
            RUNLOOP.ai
          </Text>
          <Text color={colors.textDim} dimColor>
            {" "}
            • v{VERSION}
          </Text>
        </Box>
        <Box flexDirection="column" paddingX={2}>
          {menuItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box key={item.key}>
                <Text color={isSelected ? item.color : colors.textDim}>
                  {isSelected ? figures.pointer : " "}
                </Text>
                <Text color={item.color}> {item.icon} </Text>
                <Text
                  color={isSelected ? item.color : colors.text}
                  bold={isSelected}
                >
                  {item.label}
                </Text>
                {item.betaFeature && <BetaBadge />}
                <Text color={colors.textDim} dimColor>
                  {isNarrow
                    ? ` [${index + 1}]`
                    : ` - ${item.description} [${index + 1}]`}
                </Text>
              </Box>
            );
          })}
        </Box>
        {navTips}
      </Box>
    );
  }

  // Medium layout - small banner, simple items with descriptions (or no descriptions if narrow)
  if (layoutMode === "medium") {
    return (
      <Box flexDirection="column">
        <Breadcrumb
          items={[{ label: "Home", active: true }]}
          showVersionCheck={true}
        />
        <Box paddingX={2} marginBottom={1}>
          <Text color={colors.primary} bold>
            RUNLOOP.ai
          </Text>
          <Text color={colors.textDim} dimColor>
            {isNarrow
              ? ` • v${VERSION}`
              : ` • Cloud development environments • v${VERSION}`}
          </Text>
        </Box>
        <Box flexDirection="column" paddingX={2}>
          {menuItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box key={item.key} marginBottom={0}>
                <Text color={isSelected ? item.color : colors.textDim}>
                  {isSelected ? figures.pointer : " "}
                </Text>
                <Text> </Text>
                <Text color={item.color} bold>
                  {item.icon}
                </Text>
                <Text> </Text>
                <Text
                  color={isSelected ? item.color : colors.text}
                  bold={isSelected}
                >
                  {item.label}
                </Text>
                {item.betaFeature && <BetaBadge />}
                {!isNarrow && (
                  <Text color={colors.textDim} dimColor>
                    {" "}
                    - {item.description}
                  </Text>
                )}
                <Text color={colors.textDim} dimColor>
                  {" "}
                  [{index + 1}]
                </Text>
              </Box>
            );
          })}
        </Box>
        {navTips}
      </Box>
    );
  }

  // Full layout - big banner, bordered items (or simple items if narrow)
  return (
    <Box flexDirection="column">
      <Breadcrumb
        items={[{ label: "Home", active: true }]}
        showVersionCheck={true}
      />

      <Banner />

      <Box flexDirection="column" paddingX={2} flexShrink={0}>
        <Box paddingX={1}>
          <Text color={colors.textDim} dimColor>
            Cloud development environments for your team • v{VERSION}
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" paddingX={2} marginTop={1}>
        <Box paddingX={1} flexShrink={0}>
          <Text color={colors.text} bold>
            Select a resource:
          </Text>
        </Box>

        {isNarrow ? (
          // Narrow layout - no borders, compact items
          <Box flexDirection="column" marginTop={1}>
            {menuItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <Box key={item.key}>
                  <Text color={isSelected ? item.color : colors.textDim}>
                    {isSelected ? figures.pointer : " "}
                  </Text>
                  <Text color={item.color}> {item.icon} </Text>
                  <Text
                    color={isSelected ? item.color : colors.text}
                    bold={isSelected}
                  >
                    {item.label}
                  </Text>
                  {item.betaFeature && <BetaBadge />}
                  <Text color={colors.textDim} dimColor>
                    {" "}
                    [{index + 1}]
                  </Text>
                </Box>
              );
            })}
          </Box>
        ) : (
          // Wide layout - bordered items with descriptions
          menuItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box
                key={item.key}
                paddingX={2}
                paddingY={0}
                borderStyle="single"
                borderColor={isSelected ? item.color : colors.border}
                marginTop={index === 0 ? 1 : 0}
                flexShrink={0}
              >
                {isSelected && (
                  <>
                    <Text color={item.color} bold>
                      {figures.pointer}
                    </Text>
                    <Text> </Text>
                  </>
                )}
                <Text color={item.color} bold>
                  {item.icon}
                </Text>
                <Text> </Text>
                <Text
                  color={isSelected ? item.color : colors.text}
                  bold={isSelected}
                >
                  {item.label}
                </Text>
                {item.betaFeature && <BetaBadge />}
                <Text color={colors.textDim}> </Text>
                <Text color={colors.textDim} dimColor>
                  {item.description}
                </Text>
                <Text> </Text>
                <Text color={colors.textDim} dimColor>
                  [{index + 1}]
                </Text>
              </Box>
            );
          })
        )}
      </Box>

      {navTips}
    </Box>
  );
};

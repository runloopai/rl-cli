import React from "react";
import { Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import { Banner } from "./Banner.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { VERSION } from "../version.js";
import { colors } from "../utils/theme.js";
import { execCommand } from "../utils/exec.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { useUpdateCheck } from "../hooks/useUpdateCheck.js";

interface MenuItem {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const menuItems: MenuItem[] = [
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
    key: "network-policies",
    label: "Network Policies",
    description: "Manage egress network access rules",
    icon: "◇",
    color: colors.info,
  },
  {
    key: "objects",
    label: "Objects",
    description: "Manage storage objects and files",
    icon: "▤",
    color: colors.secondary,
  },
];

interface MainMenuProps {
  onSelect: (key: string) => void;
}

export const MainMenu = ({ onSelect }: MainMenuProps) => {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Use centralized viewport hook for consistent layout
  const { terminalHeight } = useViewportHeight({ overhead: 0 });

  // Check for updates
  const { updateAvailable } = useUpdateCheck();

  // Handle Ctrl+C to exit
  useExitOnCtrlC();

  useInput((input, key) => {
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < menuItems.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (key.return) {
      onSelect(menuItems[selectedIndex].key);
    } else if (key.escape) {
      exit();
    } else if (input === "d" || input === "1") {
      onSelect("devboxes");
    } else if (input === "b" || input === "2") {
      onSelect("blueprints");
    } else if (input === "s" || input === "3") {
      onSelect("snapshots");
    } else if (input === "n" || input === "4") {
      onSelect("network-policies");
    } else if (input === "o" || input === "5") {
      onSelect("objects");
    } else if (input === "u" && updateAvailable) {
      // Release terminal and exec into update command (never returns)
      execCommand("sh", [
        "-c",
        "npm install -g @runloop/rl-cli@latest && exec rli",
      ]);
    }
  });

  // Use compact layout if terminal height is less than 20 lines (memoized)
  const useCompactLayout = terminalHeight < 20;

  if (useCompactLayout) {
    return (
      <Box flexDirection="column">
        <Box paddingX={2} marginBottom={1}>
          <Text color={colors.primary} bold>
            RUNLOOP.ai
          </Text>
          <Text color={colors.textDim} dimColor>
            {" "}
            • Cloud development environments • v{VERSION}
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
                <Text color={colors.textDim} dimColor>
                  {" "}
                  - {item.description}
                </Text>
                <Text color={colors.textDim} dimColor>
                  {" "}
                  [{index + 1}]
                </Text>
              </Box>
            );
          })}
        </Box>

        <Box paddingX={2} marginTop={1}>
          <Text color={colors.textDim} dimColor>
            {figures.arrowUp}
            {figures.arrowDown} Navigate • [1-5] Quick select • [Enter] Select •
            [Esc] Quit
            {updateAvailable && " • [u] Update"}
          </Text>
        </Box>
      </Box>
    );
  }

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

      <Box flexDirection="column" paddingX={2} marginTop={1} flexGrow={1}>
        <Box paddingX={1} flexShrink={0}>
          <Text color={colors.text} bold>
            Select a resource:
          </Text>
        </Box>

        {menuItems.map((item, index) => {
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
        })}
      </Box>

      <Box paddingX={2} flexShrink={0}>
        <Box paddingX={1}>
          <Text color={colors.textDim} dimColor>
            {figures.arrowUp}
            {figures.arrowDown} Navigate • [1-5] Quick select • [Enter] Select •
            [Esc] Quit
            {updateAvailable && " • [u] Update"}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

import React from "react";
import { Box, Text, useInput, useApp, Static } from "ink";
import figures from "figures";
import { Banner } from "./Banner.js";
import { Breadcrumb } from "./Breadcrumb.js";
import { VERSION } from "../cli.js";
import { colors } from "../utils/theme.js";
import { useViewportHeight } from "../hooks/useViewportHeight.js";
import { exitAlternateScreenBuffer } from "../utils/screen.js";

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
];

interface MainMenuProps {
  onSelect: (key: string) => void;
}

export const MainMenu = ({ onSelect }: MainMenuProps) => {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Use centralized viewport hook for consistent layout
  const { terminalHeight } = useViewportHeight({ overhead: 0 });

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
    } else if (key.ctrl && input === "c") {
      exitAlternateScreenBuffer();
      process.exit(130);
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
            {figures.arrowDown} Navigate • [1-3] Quick select • [Enter] Select •
            [Esc] Quit
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Breadcrumb items={[{ label: "Home", active: true }]} />

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
            {figures.arrowDown} Navigate • [1-3] Quick select • [Enter] Select •
            [Esc] Quit
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

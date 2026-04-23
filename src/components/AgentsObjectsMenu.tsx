import React from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import figures from "figures";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";
import { useMenuStore } from "../store/menuStore.js";

interface AgentsObjectsMenuItem {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const menuItems: AgentsObjectsMenuItem[] = [
  {
    key: "agents",
    label: "Agents",
    description: "Manage AI agents for devboxes",
    icon: "◆",
    color: colors.warning,
  },
  {
    key: "objects",
    label: "Objects",
    description: "Manage files and data in cloud storage",
    icon: "▤",
    color: colors.secondary,
  },
  {
    key: "axons",
    label: "Axons",
    description: "Event streams for devboxes",
    icon: "◇",
    color: colors.accent3,
  },
];

interface AgentsObjectsMenuProps {
  onSelect: (key: string) => void;
  onBack: () => void;
}

export const AgentsObjectsMenu = ({
  onSelect,
  onBack,
}: AgentsObjectsMenuProps) => {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { agentsObjectsSelectedKey, setAgentsObjectsSelectedKey } =
    useMenuStore();

  // Calculate initial index from persisted key
  const initialIndex = React.useMemo(() => {
    const index = menuItems.findIndex(
      (item) => item.key === agentsObjectsSelectedKey,
    );
    return index >= 0 ? index : 0;
  }, [agentsObjectsSelectedKey]);

  const [selectedIndex, setSelectedIndex] = React.useState(initialIndex);

  // Persist selection when it changes
  React.useEffect(() => {
    const currentKey = menuItems[selectedIndex]?.key;
    if (currentKey && currentKey !== agentsObjectsSelectedKey) {
      setAgentsObjectsSelectedKey(currentKey);
    }
  }, [selectedIndex, agentsObjectsSelectedKey, setAgentsObjectsSelectedKey]);

  // Get terminal dimensions for responsive layout
  const getTerminalDimensions = React.useCallback(() => {
    return {
      width: stdout?.columns && stdout.columns > 0 ? stdout.columns : 80,
    };
  }, [stdout]);

  const [terminalDimensions, setTerminalDimensions] = React.useState(
    getTerminalDimensions,
  );

  React.useEffect(() => {
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

  const terminalWidth = terminalDimensions.width;
  const isNarrow = terminalWidth < 70;

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
      onBack();
    } else if (input === "g" || input === "1") {
      onSelect("agents");
    } else if (input === "o" || input === "2") {
      onSelect("objects");
    } else if (input === "x" || input === "3") {
      onSelect("axons");
    } else if (input === "q") {
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Breadcrumb
        items={[{ label: "Home" }, { label: "Agents & Objects", active: true }]}
      />

      <Box paddingX={2} marginBottom={1}>
        <Text color={colors.primary} bold>
          Agents & Objects
        </Text>
        <Text color={colors.textDim} dimColor>
          {isNarrow ? "" : " • Manage agents, objects, and event streams"}
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

      <NavigationTips
        showArrows
        paddingX={2}
        tips={[
          { key: "1-3", label: "Quick select" },
          { key: "Enter", label: "Select" },
          { key: "Esc", label: "Back" },
          { key: "q", label: "Quit" },
        ]}
      />
    </Box>
  );
};

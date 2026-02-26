import React from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import figures from "figures";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

interface SettingsMenuItem {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const settingsMenuItems: SettingsMenuItem[] = [
  {
    key: "network-policies",
    label: "Network Policies",
    description: "Manage egress network access rules",
    icon: "◇",
    color: colors.info,
  },
  {
    key: "gateway-configs",
    label: "Agent Gateway Configs",
    description: "Configure API credential proxying",
    icon: "⬡",
    color: colors.success,
  },
  {
    key: "mcp-configs",
    label: "MCP Configs",
    description: "Configure MCP server connections and tool access",
    icon: "⬢",
    color: colors.primary,
  },
  {
    key: "secrets",
    label: "Secrets",
    description: "Manage sensitive values and credentials",
    icon: "◆",
    color: colors.warning,
  },
];

interface SettingsMenuProps {
  onSelect: (key: string) => void;
  onBack: () => void;
}

export const SettingsMenu = ({ onSelect, onBack }: SettingsMenuProps) => {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const { stdout } = useStdout();

  // Get terminal dimensions for responsive layout
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
    } else if (key.downArrow && selectedIndex < settingsMenuItems.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (key.return) {
      onSelect(settingsMenuItems[selectedIndex].key);
    } else if (key.escape) {
      onBack();
    } else if (input === "n" || input === "1") {
      onSelect("network-policies");
    } else if (input === "g" || input === "2") {
      onSelect("gateway-configs");
    } else if (input === "m" || input === "3") {
      onSelect("mcp-configs");
    } else if (input === "s" || input === "4") {
      onSelect("secrets");
    } else if (input === "q") {
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Breadcrumb
        items={[{ label: "Home" }, { label: "Settings", active: true }]}
      />

      <Box paddingX={2} marginBottom={1}>
        <Text color={colors.primary} bold>
          Settings
        </Text>
        <Text color={colors.textDim} dimColor>
          {isNarrow ? "" : " • Configure your environment"}
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={2}>
        {settingsMenuItems.map((item, index) => {
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
          { key: "1-4", label: "Quick select" },
          { key: "Enter", label: "Select" },
          { key: "Esc", label: "Back" },
          { key: "q", label: "Quit" },
        ]}
      />
    </Box>
  );
};

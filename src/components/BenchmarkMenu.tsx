/**
 * BenchmarkMenu - Sub-menu for benchmark-related resources
 */
import React from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import figures from "figures";
import { Breadcrumb } from "./Breadcrumb.js";
import { NavigationTips } from "./NavigationTips.js";
import { colors } from "../utils/theme.js";
import { useExitOnCtrlC } from "../hooks/useExitOnCtrlC.js";

interface BenchmarkMenuItem {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const benchmarkMenuItems: BenchmarkMenuItem[] = [
  {
    key: "benchmark-runs",
    label: "Benchmark Runs",
    description: "View and manage benchmark executions",
    icon: "▶",
    color: colors.success,
  },
  {
    key: "scenario-runs",
    label: "Scenario Runs",
    description: "View individual scenario results",
    icon: "◈",
    color: colors.info,
  },
];

interface BenchmarkMenuProps {
  onSelect: (key: string) => void;
  onBack: () => void;
}

export const BenchmarkMenu = ({ onSelect, onBack }: BenchmarkMenuProps) => {
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
    } else if (key.downArrow && selectedIndex < benchmarkMenuItems.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (key.return) {
      onSelect(benchmarkMenuItems[selectedIndex].key);
    } else if (key.escape) {
      onBack();
    } else if (input === "b" || input === "1") {
      onSelect("benchmark-runs");
    } else if (input === "s" || input === "2") {
      onSelect("scenario-runs");
    } else if (input === "q") {
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Breadcrumb
        items={[{ label: "Home" }, { label: "Benchmarks", active: true }]}
      />

      <Box paddingX={2} marginBottom={1}>
        <Text color={colors.primary} bold>
          Benchmarks
        </Text>
        <Text color={colors.textDim} dimColor>
          {isNarrow ? "" : " • Performance testing and evaluation"}
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={2}>
        {benchmarkMenuItems.map((item, index) => {
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
          { key: "1-2", label: "Quick select" },
          { key: "Enter", label: "Select" },
          { key: "Esc", label: "Back" },
          { key: "q", label: "Quit" },
        ]}
      />
    </Box>
  );
};

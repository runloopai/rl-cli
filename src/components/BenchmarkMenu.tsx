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
import { useMenuStore } from "../store/menuStore.js";

/*
Some useful icon chars
 
  Circles:
  ◉  FISHEYE (U+25C9)           - currently used for Benchmark Defs
  ◎  BULLSEYE (U+25CE)
  ◐  CIRCLE LEFT HALF BLACK (U+25D0)
  ◑  CIRCLE RIGHT HALF BLACK (U+25D1)
  ⊕  CIRCLED PLUS (U+2295)
  ⊗  CIRCLED TIMES (U+2297)
  ⊙  CIRCLED DOT (U+2299)

  Squares:
  ▣  SQUARE W/ BLACK SMALL SQ   - currently used for Orchestrator Jobs
  ▩  SQUARE W/ DIAGONAL CROSS   - currently used for Legacy Runs
  ◧  SQUARE LEFT HALF BLACK (U+25E7)
  ◨  SQUARE RIGHT HALF BLACK (U+25E8)
  ◫  SQUARE W/ VERTICAL LINE (U+25EB)
  ▦  SQUARE W/ CROSSHATCH (U+25A6)
  ▧  SQUARE W/ DIAGONAL FILL (U+25A7)

  Diamonds / Triangles / Stars:
  ◈  DIAMOND W/ BLACK DIAMOND   - currently used for Scenario Runs
  ◆  BLACK DIAMOND (U+25C6)
  ◇  WHITE DIAMOND (U+25C7)
  ▲  BLACK UP TRIANGLE (U+25B2)
  △  WHITE UP TRIANGLE (U+25B3)
  ★  BLACK STAR (U+2605)
  ⬡  WHITE HEXAGON (U+2B21)
  ⬢  BLACK HEXAGON (U+2B22)
  ▶  BLACK RIGHT-POINTING TRIANGLE (U+25B6)   This one renders weirdly, with an extra space
  ▷  WHITE RIGHT-POINTING TRIANGLE (U+25B7)
  ►  BLACK RIGHT-POINTING POINTER (U+25BA)
  ▻  WHITE RIGHT-POINTING POINTER (U+25BB)

  ✦  BLACK FOUR POINTED STAR (U+2726)
  ✧  WHITE FOUR POINTED STAR (U+2727)
  ✚  HEAVY GREEK CROSS (U+271A)
  ✜  HEAVY OPEN CENTRE CROSS (U+271C)
  ✛  OPEN CENTRE CROSS (U+271B)
  ❖  BLACK DIAMOND MINUS WHITE X (U+2756)
  ✥  FOUR CLUB-SPOKED ASTERISK (U+2725)
  ❋  HEAVY EIGHT TEARDROP-SPOKED PROPELLER ASTERISK (U+274B)
  ✳  EIGHT SPOKED ASTERISK (U+2733)
  ✴  EIGHT POINTED BLACK STAR (U+2734)
*/

interface BenchmarkMenuItem {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

const benchmarkMenuItems: BenchmarkMenuItem[] = [
  {
    key: "benchmarks",
    label: "Available Benchmarks",
    description: "View benchmark definitions",
    icon: "◉",
    color: colors.primary,
  },
  {
    key: "benchmark-jobs",
    label: "Benchmark Orchestrator Jobs",
    description: "Run and manage benchmark jobs",
    icon: "▲",
    color: colors.warning,
  },
  {
    key: "benchmark-runs",
    label: "Manual Benchmark Runs",
    description: "View and manage benchmark executions",
    icon: "◇",
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
  const { stdout } = useStdout();
  const { benchmarkSelectedKey, setBenchmarkSelectedKey } = useMenuStore();

  // Calculate initial index from persisted key
  const initialIndex = React.useMemo(() => {
    const index = benchmarkMenuItems.findIndex(
      (item) => item.key === benchmarkSelectedKey,
    );
    return index >= 0 ? index : 0;
  }, [benchmarkSelectedKey]);

  const [selectedIndex, setSelectedIndex] = React.useState(initialIndex);

  // Persist selection when it changes
  React.useEffect(() => {
    const currentKey = benchmarkMenuItems[selectedIndex]?.key;
    if (currentKey && currentKey !== benchmarkSelectedKey) {
      setBenchmarkSelectedKey(currentKey);
    }
  }, [selectedIndex, benchmarkSelectedKey, setBenchmarkSelectedKey]);

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
    } else if (input >= "1" && input <= String(benchmarkMenuItems.length)) {
      onSelect(benchmarkMenuItems[parseInt(input) - 1].key);
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
              <Text
                color={isSelected ? item.color : colors.text}
                bold={isSelected}
              >
                {" "}
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

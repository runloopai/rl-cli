import React from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import figures from "figures";
import {
  setThemePreference,
  getThemePreference,
  clearDetectedTheme,
} from "../utils/config.js";
import { Header } from "../components/Header.js";
import { SuccessMessage } from "../components/SuccessMessage.js";
import { colors, getCurrentTheme, setThemeMode } from "../utils/theme.js";

interface ThemeOption {
  value: "auto" | "light" | "dark";
  label: string;
  description: string;
}

const themeOptions: ThemeOption[] = [
  {
    value: "auto",
    label: "Auto-detect",
    description: "Automatically detect terminal background color",
  },
  {
    value: "dark",
    label: "Dark mode",
    description: "Light text on dark background",
  },
  {
    value: "light",
    label: "Light mode",
    description: "Dark text on light background",
  },
];

interface InteractiveThemeSelectorProps {
  initialTheme: "auto" | "light" | "dark";
}

const InteractiveThemeSelector = ({
  initialTheme,
}: InteractiveThemeSelectorProps) => {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = React.useState(() =>
    themeOptions.findIndex((opt) => opt.value === initialTheme),
  );
  const [saved, setSaved] = React.useState(false);
  const [detectedTheme] = React.useState<"light" | "dark">(getCurrentTheme());

  // Update theme preview when selection changes
  React.useEffect(() => {
    const newTheme = themeOptions[selectedIndex].value;
    let targetTheme: "light" | "dark";

    if (newTheme === "auto") {
      // For auto mode, show the detected theme
      targetTheme = detectedTheme;
    } else {
      // For explicit light/dark, set directly without detection
      targetTheme = newTheme;
    }

    // Apply theme change for preview
    setThemeMode(targetTheme);
  }, [selectedIndex, detectedTheme]);

  useInput((input, key) => {
    if (saved) {
      exit();
      return;
    }

    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < themeOptions.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (key.return) {
      // Save the selected theme to config
      const selectedTheme = themeOptions[selectedIndex].value;
      setThemePreference(selectedTheme);

      // If setting to 'auto', clear cached detection for re-run
      if (selectedTheme === "auto") {
        clearDetectedTheme();
      }

      setSaved(true);
      setTimeout(() => exit(), 1500);
    } else if (key.escape || input === "q") {
      // Restore original theme without re-running detection
      setThemePreference(initialTheme);
      if (initialTheme === "auto") {
        setThemeMode(detectedTheme);
      } else {
        setThemeMode(initialTheme);
      }
      exit();
    }
  });

  if (saved) {
    return (
      <>
        <Header title="Theme Configuration" />
        <SuccessMessage
          message={`Theme set to: ${themeOptions[selectedIndex].label}`}
          details="Theme applied immediately!"
        />
      </>
    );
  }

  return (
    <Box flexDirection="column">
      <Header title="Theme Configuration - Interactive" />

      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text color={colors.textDim}>Current preference: </Text>
          <Text color={colors.primary} bold>
            {themeOptions[selectedIndex].label}
          </Text>
          {themeOptions[selectedIndex].value === "auto" && (
            <Text color={colors.textDim}> (detected: {detectedTheme})</Text>
          )}
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={colors.text} bold>
          Select theme mode:
        </Text>
        <Box marginTop={1} flexDirection="column">
          {themeOptions.map((option, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box key={option.value} marginY={0}>
                <Text color={isSelected ? colors.primary : colors.textDim}>
                  {isSelected ? figures.pointer : " "}{" "}
                </Text>
                <Text
                  color={isSelected ? colors.primary : colors.text}
                  bold={isSelected}
                >
                  {option.label}
                </Text>
                <Text color={colors.textDim}> - {option.description}</Text>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box marginTop={2} flexDirection="column">
        <Text color={colors.text} bold>
          {figures.play} Live Preview:
        </Text>
        <Box
          marginTop={1}
          marginLeft={2}
          paddingX={2}
          paddingY={1}
          borderStyle="round"
          borderColor={colors.primary}
          flexDirection="column"
        >
          <Box>
            <Text color={colors.primary} bold>
              {figures.tick} Primary
            </Text>
            <Text> </Text>
            <Text color={colors.secondary} bold>
              {figures.star} Secondary
            </Text>
          </Box>
          <Box>
            <Text color={colors.success}>{figures.tick} Success</Text>
            <Text> </Text>
            <Text color={colors.warning}>{figures.warning} Warning</Text>
            <Text> </Text>
            <Text color={colors.error}>{figures.cross} Error</Text>
          </Box>
          <Box>
            <Text color={colors.text}>Normal text</Text>
            <Text> </Text>
            <Text color={colors.textDim}>Dim text</Text>
          </Box>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={colors.textDim} dimColor>
          {figures.arrowUp}
          {figures.arrowDown} Navigate • [Enter] Save • [Esc] Cancel
        </Text>
      </Box>
    </Box>
  );
};

interface StaticConfigUIProps {
  action?: "get" | "set";
  value?: "auto" | "light" | "dark";
}

const StaticConfigUI = ({ action, value }: StaticConfigUIProps) => {
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (action === "set" && value) {
      setThemePreference(value);

      // If setting to 'auto', clear the cached detection so it re-runs on next start
      if (value === "auto") {
        clearDetectedTheme();
      }

      setSaved(true);
      setTimeout(() => process.exit(0), 1500);
    } else if (action === "get" || !action) {
      setTimeout(() => process.exit(0), 2000);
    }
  }, [action, value]);

  const currentPreference = getThemePreference();
  const activeTheme = getCurrentTheme();

  if (saved) {
    return (
      <>
        <Header title="Theme Configuration" />
        <SuccessMessage
          message={`Theme set to: ${value}`}
          details="Restart the CLI for changes to take effect"
        />
      </>
    );
  }

  return (
    <Box flexDirection="column">
      <Header title="Theme Configuration" />

      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text color={colors.textDim}>Current preference: </Text>
          <Text color={colors.primary} bold>
            {currentPreference}
          </Text>
        </Box>
        <Box>
          <Text color={colors.textDim}>Active theme: </Text>
          <Text color={colors.success} bold>
            {activeTheme}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={colors.text} bold>
          Available options:
        </Text>
        <Box marginLeft={2} flexDirection="column">
          <Text color={colors.textDim}>
            • <Text color={colors.primary}>auto</Text> - Detect terminal
            background automatically
          </Text>
          <Text color={colors.textDim}>
            • <Text color={colors.primary}>light</Text> - Force light mode (dark
            text on light background)
          </Text>
          <Text color={colors.textDim}>
            • <Text color={colors.primary}>dark</Text> - Force dark mode (light
            text on dark background)
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={colors.textDim} dimColor>
          Usage: rli config theme [auto|light|dark]
        </Text>
        <Text color={colors.textDim} dimColor>
          Environment variable: RUNLOOP_THEME
        </Text>
      </Box>
    </Box>
  );
};

export function showThemeConfig() {
  const currentTheme = getThemePreference();
  render(<InteractiveThemeSelector initialTheme={currentTheme} />);
}

export function setThemeConfig(theme: "auto" | "light" | "dark") {
  render(<StaticConfigUI action="set" value={theme} />);
}

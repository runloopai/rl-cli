import React from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import figures from 'figures';
import { Banner } from './Banner.js';
import { Breadcrumb } from './Breadcrumb.js';

interface MenuItem {
  key: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

interface MainMenuProps {
  onSelect: (key: string) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onSelect }) => {
  const { exit } = useApp();
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Calculate terminal height once at mount
  const terminalHeight = process.stdout.rows || 24;

  const menuItems: MenuItem[] = [
    {
      key: 'devboxes',
      label: 'Devboxes',
      description: 'Manage cloud development environments',
      icon: '◉',
      color: 'cyan',
    },
    {
      key: 'blueprints',
      label: 'Blueprints',
      description: 'Create and manage devbox templates',
      icon: '▣',
      color: 'magenta',
    },
    {
      key: 'snapshots',
      label: 'Snapshots',
      description: 'Save and restore devbox states',
      icon: '◈',
      color: 'green',
    },
  ];

  useInput((input, key) => {
    if (key.upArrow && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (key.downArrow && selectedIndex < menuItems.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    } else if (key.return) {
      onSelect(menuItems[selectedIndex].key);
    } else if (key.escape) {
      exit();
    } else if (input === 'd' || input === '1') {
      onSelect('devboxes');
    } else if (input === 'b' || input === '2') {
      onSelect('blueprints');
    } else if (input === 's' || input === '3') {
      onSelect('snapshots');
    }
  });

  // Use compact layout if terminal height is less than 20 lines
  const useCompactLayout = terminalHeight < 20;

  if (useCompactLayout) {
    return (
      <Box flexDirection="column" height="100%">
        <Box paddingX={2} marginBottom={1}>
          <Text color="cyan" bold>
            RUNLOOP.ai
          </Text>
          <Text color="gray" dimColor>
            {' '}
            • Cloud development environments
          </Text>
        </Box>

        <Box flexDirection="column" paddingX={2}>
          {menuItems.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <Box key={item.key} marginBottom={0}>
                <Text color={isSelected ? item.color : 'gray'}>
                  {isSelected ? figures.pointer : ' '}
                </Text>
                <Text> </Text>
                <Text color={item.color} bold>
                  {item.icon}
                </Text>
                <Text> </Text>
                <Text color={isSelected ? item.color : 'white'} bold={isSelected}>
                  {item.label}
                </Text>
                <Text color="gray" dimColor>
                  {' '}
                  - {item.description}
                </Text>
                <Text color="gray" dimColor>
                  {' '}
                  [{index + 1}]
                </Text>
              </Box>
            );
          })}
        </Box>

        <Box paddingX={2} marginTop={1}>
          <Text color="gray" dimColor>
            {figures.arrowUp}{figures.arrowDown} Navigate • [1-3] Quick select • [Enter] Select • [Esc] Quit
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Breadcrumb items={[{ label: 'Home', active: true }]} />

      <Box marginBottom={1}>
        <Banner />
      </Box>

      <Box flexDirection="column" paddingX={2} marginBottom={1}>
        <Box paddingX={1}>
          <Text color="gray" dimColor>
            Cloud development environments for your team
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" paddingX={2} marginBottom={1} marginTop={1}>
        <Box marginBottom={1} paddingX={1}>
          <Text color="white" bold>
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
              borderStyle={isSelected ? 'round' : 'single'}
              borderColor={isSelected ? item.color : 'gray'}
              marginBottom={0}
            >
              <Text color={item.color} bold>
                {item.icon}
              </Text>
              <Text> </Text>
              <Text color={isSelected ? item.color : 'white'} bold={isSelected}>
                {item.label}
              </Text>
              <Text color="gray"> </Text>
              <Text color="gray" dimColor>
                {item.description}
              </Text>
              <Text> </Text>
              <Text color="gray" dimColor>
                [{index + 1}]
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box paddingX={2}>
        <Box paddingX={1}>
          <Text color="gray" dimColor>
            {figures.arrowUp}{figures.arrowDown} Navigate • [1-3] Quick select • [Enter] Select • [Esc] Quit
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

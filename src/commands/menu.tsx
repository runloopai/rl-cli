import React from 'react';
import { render, useApp } from 'ink';
import { MainMenu } from '../components/MainMenu.js';

// Import list components dynamically to avoid circular deps
type Screen = 'menu' | 'devboxes' | 'blueprints' | 'snapshots';

// Import the UI components directly
import { ListDevboxesUI } from './devbox/list.js';
import { ListBlueprintsUI } from './blueprint/list.js';
import { ListSnapshotsUI } from './snapshot/list.js';

import { Box } from 'ink';

const App: React.FC = () => {
  const { exit } = useApp();
  const [currentScreen, setCurrentScreen] = React.useState<Screen>('menu');
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  const handleMenuSelect = (key: string) => {
    setCurrentScreen(key as Screen);
    // Force a full re-render to clear any stale content
    setTimeout(() => forceUpdate(), 0);
  };

  const handleBack = () => {
    setCurrentScreen('menu');
    // Force a full re-render to clear any stale content
    setTimeout(() => forceUpdate(), 0);
  };

  const handleExit = () => {
    exit();
  };

  // Wrap everything in a full-height container
  return (
    <Box flexDirection="column" minHeight={process.stdout.rows || 24}>
      {currentScreen === 'menu' && <MainMenu onSelect={handleMenuSelect} />}
      {currentScreen === 'devboxes' && <ListDevboxesUI onBack={handleBack} onExit={handleExit} />}
      {currentScreen === 'blueprints' && <ListBlueprintsUI onBack={handleBack} onExit={handleExit} />}
      {currentScreen === 'snapshots' && <ListSnapshotsUI onBack={handleBack} onExit={handleExit} />}
    </Box>
  );
};

export async function runMainMenu() {
  // Enter alternate screen buffer once at the start
  process.stdout.write('\x1b[?1049h');

  try {
    const { waitUntilExit } = render(<App />);
    await waitUntilExit();
  } finally {
    // Exit alternate screen buffer once at the end
    process.stdout.write('\x1b[?1049l');
  }

  process.exit(0);
}

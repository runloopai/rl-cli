import React from 'react';
import { render, useApp } from 'ink';
import { MainMenu } from '../components/MainMenu.js';

// Import list components dynamically to avoid circular deps
type Screen = 'menu' | 'devboxes' | 'blueprints' | 'snapshots';

// Import the UI components directly
import { ListDevboxesUI } from './devbox/list.js';
import { ListBlueprintsUI } from './blueprint/list.js';
import { ListSnapshotsUI } from './snapshot/list.js';

const App: React.FC = () => {
  const { exit } = useApp();
  const [currentScreen, setCurrentScreen] = React.useState<Screen>('menu');

  const handleMenuSelect = (key: string) => {
    setCurrentScreen(key as Screen);
  };

  const handleBack = () => {
    setCurrentScreen('menu');
  };

  const handleExit = () => {
    exit();
  };

  if (currentScreen === 'menu') {
    return <MainMenu onSelect={handleMenuSelect} />;
  }

  if (currentScreen === 'devboxes') {
    return <ListDevboxesUI onBack={handleBack} onExit={handleExit} />;
  }

  if (currentScreen === 'blueprints') {
    return <ListBlueprintsUI onBack={handleBack} onExit={handleExit} />;
  }

  if (currentScreen === 'snapshots') {
    return <ListSnapshotsUI onBack={handleBack} onExit={handleExit} />;
  }

  return null;
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

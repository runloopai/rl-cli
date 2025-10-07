import React from 'react';
import { render } from 'ink';
import { MainMenu } from '../components/MainMenu.js';
import { listDevboxes } from './devbox/list.js';
import { listBlueprints } from './blueprint/list.js';
import { listSnapshots } from './snapshot/list.js';

export async function showMainMenu() {
  return new Promise<string>((resolve) => {
    const { waitUntilExit } = render(
      <MainMenu
        onSelect={(key) => {
          resolve(key);
        }}
      />
    );

    waitUntilExit().then(() => {
      // If the user quits without selecting, resolve with empty string
      resolve('');
    });
  });
}

export async function runMainMenu() {
  // Enter alternate screen buffer
  process.stdout.write('\x1b[?1049h');

  while (true) {
    console.clear();
    const selection = await showMainMenu();

    if (!selection) {
      // User quit
      // Exit alternate screen buffer
      process.stdout.write('\x1b[?1049l');
      process.exit(0);
    }

    console.clear();

    // Navigate to the selected list view
    switch (selection) {
      case 'devboxes':
        await listDevboxes({ output: undefined });
        break;
      case 'blueprints':
        await listBlueprints({ output: undefined });
        break;
      case 'snapshots':
        await listSnapshots({ output: undefined });
        break;
      default:
        // Unknown selection, return to menu
        continue;
    }
  }
}

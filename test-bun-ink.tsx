#!/usr/bin/env node
/**
 * Minimal Ink TUI test to verify Bun compatibility
 * Tests key features: rendering, input handling, raw mode
 *
 * Run with: bun run test-bun-ink.tsx
 */

import React, { useState } from 'react';
import { render, Text, Box, useInput } from 'ink';

function TestApp() {
  const [input, setInput] = useState('');
  const [keyPresses, setKeyPresses] = useState<string[]>([]);

  useInput((inputChar, key) => {
    if (key.escape) {
      process.exit(0);
    }

    const keyInfo = key.return ? '<ENTER>' :
                   key.upArrow ? '<UP>' :
                   key.downArrow ? '<DOWN>' :
                   key.leftArrow ? '<LEFT>' :
                   key.rightArrow ? '<RIGHT>' :
                   inputChar;

    setKeyPresses(prev => [...prev.slice(-5), keyInfo]);
    setInput(prev => prev + inputChar);
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="green" padding={1} marginBottom={1}>
        <Text color="cyan" bold>
          🧪 Bun + Ink Compatibility Test
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>
          <Text color="yellow">Status: </Text>
          <Text color="green" bold>✓ Rendering works!</Text>
        </Text>
        <Text>
          <Text color="yellow">Raw mode: </Text>
          <Text color="green" bold>✓ Active (receiving input)</Text>
        </Text>
      </Box>

      <Box borderStyle="single" padding={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text dimColor>Last 6 key presses:</Text>
          {keyPresses.length === 0 ? (
            <Text italic dimColor>Press some keys...</Text>
          ) : (
            keyPresses.map((key, i) => (
              <Text key={i}>  {i + 1}. {key}</Text>
            ))
          )}
        </Box>
      </Box>

      <Box borderStyle="single" padding={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text dimColor>Input buffer:</Text>
          <Text color="cyan">{input || '<empty>'}</Text>
        </Box>
      </Box>

      <Text dimColor italic>
        Press ESC to exit | Try arrow keys, letters, numbers
      </Text>
    </Box>
  );
}

console.log('Starting Ink TUI test with Bun...\n');

// WORKAROUND: Bun doesn't call process.stdin.resume() automatically
// See: https://github.com/oven-sh/bun/issues/6862
process.stdin.resume();

const { unmount, waitUntilExit } = render(<TestApp />);

waitUntilExit().then(() => {
  console.log('\n✓ Test completed successfully!');
  console.log('Ink appears to be compatible with Bun.\n');
}).catch((error) => {
  console.error('\n✗ Test failed:', error);
  process.exit(1);
});

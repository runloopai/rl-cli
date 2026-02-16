#!/usr/bin/env node
/**
 * Test raw mode directly without Ink to see if Bun supports it
 */

console.log('Testing raw mode support in Bun...\n');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isBun = typeof (globalThis as any).Bun !== 'undefined';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bunVersion = isBun ? (globalThis as any).Bun.version : null;

console.log('Runtime:', isBun ? 'Bun' : 'Node.js');
console.log('Version:', bunVersion || process.version);
console.log('');

// Check if stdin has setRawMode
console.log('process.stdin.isTTY:', process.stdin.isTTY);
console.log('process.stdin.setRawMode exists:', typeof process.stdin.setRawMode);
console.log('');

if (!process.stdin.isTTY) {
  console.error('stdin is not a TTY - raw mode requires interactive terminal');
  process.exit(1);
}

if (typeof process.stdin.setRawMode !== 'function') {
  console.error('setRawMode is not available');
  process.exit(1);
}

console.log('✓ setRawMode is available');
console.log('Attempting to enable raw mode...\n');

try {
  process.stdin.setRawMode(true);
  console.log('✓ Raw mode enabled successfully!');
  console.log('Press any key (ESC to exit)...\n');

  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (key) => {
    // Ctrl+C or ESC
    if (key === '\u0003' || key === '\u001b') {
      console.log('\n\nExiting...');
      process.stdin.setRawMode(false);
      process.exit(0);
    }

    console.log('Key pressed:', JSON.stringify(key), '(code:', key.charCodeAt(0), ')');
  });

} catch (error) {
  console.error('✗ Failed to enable raw mode:', error);
  process.exit(1);
}

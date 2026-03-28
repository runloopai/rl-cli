#!/usr/bin/env node
/**
 * Test raw mode directly without Ink to see if Bun supports it
 */

console.log('Testing raw mode support in Bun...\n');

const globalWithBun = globalThis as typeof globalThis & {
  Bun?: { version: string };
};

console.log('Runtime:', globalWithBun.Bun ? 'Bun' : 'Node.js');
console.log('Version:', globalWithBun.Bun?.version || process.version);
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

  process.stdin.on('data', (key: string | Buffer) => {
    const keyStr = typeof key === 'string' ? key : key.toString();

    // Ctrl+C or ESC
    if (keyStr === '\u0003' || keyStr === '\u001b') {
      console.log('\n\nExiting...');
      process.stdin.setRawMode(false);
      process.exit(0);
    }

    console.log('Key pressed:', JSON.stringify(keyStr), '(code:', keyStr.charCodeAt(0), ')');
  });

} catch (error) {
  console.error('✗ Failed to enable raw mode:', error);
  process.exit(1);
}

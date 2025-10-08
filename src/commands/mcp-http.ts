#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function startMcpHttpServer(port?: number) {
  // Get the path to the compiled MCP HTTP server
  const serverPath = join(__dirname, '../mcp/server-http.js');

  const env = { ...process.env };
  if (port) {
    env.PORT = port.toString();
  }

  console.log(`Starting Runloop MCP HTTP server on port ${port || 3000}...`);
  console.log('Press Ctrl+C to stop\n');

  // Start the MCP HTTP server as a child process
  const serverProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env,
  });

  serverProcess.on('error', error => {
    console.error('Failed to start MCP HTTP server:', error);
    process.exit(1);
  });

  serverProcess.on('exit', code => {
    if (code !== 0) {
      console.error(`MCP HTTP server exited with code ${code}`);
      process.exit(code || 1);
    }
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\nShutting down MCP HTTP server...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });
}

#!/usr/bin/env node
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { createWriteStream } from 'fs';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const mcpBuildDir = join(rootDir, 'src', 'mcp');

const require = createRequire(import.meta.url);

async function bundleMCPServer() {
  console.log('🔨 Building MCP server bundle...');

  // Bundle the server code with all dependencies
  await build({
    entryPoints: [join(rootDir, 'dist', 'mcp', 'server.js')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs', // Use CommonJS to avoid ESM dynamic import issues
    outfile: join(mcpBuildDir, 'index.js'),
    // Don't add banner - the source file already has the shebang
    // Bundle everything - no external dependencies
    external: [],
    minify: true,
    sourcemap: false,
    treeShaking: true,
  });

  console.log('✅ Bundle created at src/mcp/index.js');

  // Create .mcpb archive
  const outputPath = join(rootDir, 'runloop-mcp-server.mcpb');
  await createMCPBArchive(mcpBuildDir, outputPath);

  const { stat } = await import('fs/promises');
  const stats = await stat(outputPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log(`✅ MCPB archive created at ${outputPath} (${sizeMB} MB)`);
}

async function createMCPBArchive(sourceDir, outputPath) {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  // Use native zip command
  const cwd = sourceDir;
  await execAsync(`zip -9 "${outputPath}" index.js manifest.json`, { cwd });
}

bundleMCPServer().catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});

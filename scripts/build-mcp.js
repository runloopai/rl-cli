#!/usr/bin/env node
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { packExtension } from '@anthropic-ai/mcpb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const mcpBuildDir = join(rootDir, 'src', 'mcp');

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

  // Create .mcpb archive using official Anthropic package
  const outputPath = join(rootDir, 'runloop-mcp-server.mcpb');
  await packExtension({
    extensionPath: mcpBuildDir,
    outputPath: outputPath,
    silent: false
  });

  const { stat } = await import('fs/promises');
  const stats = await stat(outputPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log(`✅ MCPB archive created at ${outputPath} (${sizeMB} MB)`);
}

bundleMCPServer().catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});

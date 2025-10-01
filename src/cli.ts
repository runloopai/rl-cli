#!/usr/bin/env node

import { Command } from 'commander';
import { createDevbox } from './commands/devbox/create.js';
import { listDevboxes } from './commands/devbox/list.js';
import { deleteDevbox } from './commands/devbox/delete.js';
import { execCommand } from './commands/devbox/exec.js';
import { uploadFile } from './commands/devbox/upload.js';
import { getConfig } from './utils/config.js';

const program = new Command();

program
  .name('rln')
  .description('Beautiful CLI for Runloop devbox management')
  .version('1.0.0');

program
  .command('auth')
  .description('Configure API authentication')
  .action(async () => {
    const { default: auth } = await import('./commands/auth.js');
    auth();
  });

// Devbox commands
const devbox = program
  .command('devbox')
  .description('Manage devboxes')
  .alias('d');

devbox
  .command('create')
  .description('Create a new devbox')
  .option('-n, --name <name>', 'Devbox name')
  .option('-t, --template <template>', 'Template to use')
  .option('-o, --output <format>', 'Output format (text, json, yaml)', 'text')
  .action(createDevbox);

devbox
  .command('list')
  .description('List all devboxes')
  .option('-s, --status <status>', 'Filter by status')
  .option('-o, --output <format>', 'Output format (text, json, yaml)', 'text')
  .action(listDevboxes);

devbox
  .command('delete <id>')
  .description('Shutdown a devbox')
  .alias('rm')
  .option('-o, --output <format>', 'Output format (text, json, yaml)', 'text')
  .action(deleteDevbox);

devbox
  .command('exec <id> <command...>')
  .description('Execute a command in a devbox')
  .option('-o, --output <format>', 'Output format (text, json, yaml)', 'text')
  .action(execCommand);

devbox
  .command('upload <id> <file>')
  .description('Upload a file to a devbox')
  .option('-p, --path <path>', 'Target path in devbox')
  .option('-o, --output <format>', 'Output format (text, json, yaml)', 'text')
  .action(uploadFile);

// Snapshot commands
const snapshot = program
  .command('snapshot')
  .description('Manage devbox snapshots')
  .alias('snap');

snapshot
  .command('list')
  .description('List all snapshots')
  .option('-d, --devbox <id>', 'Filter by devbox ID')
  .option('-o, --output <format>', 'Output format (text, json, yaml)', 'text')
  .action(async (options) => {
    const { listSnapshots } = await import('./commands/snapshot/list.js');
    listSnapshots(options);
  });

snapshot
  .command('create <devbox-id>')
  .description('Create a snapshot of a devbox')
  .option('-n, --name <name>', 'Snapshot name')
  .option('-o, --output <format>', 'Output format (text, json, yaml)', 'text')
  .action(async (devboxId, options) => {
    const { createSnapshot } = await import('./commands/snapshot/create.js');
    createSnapshot(devboxId, options);
  });

snapshot
  .command('delete <id>')
  .description('Delete a snapshot')
  .alias('rm')
  .option('-o, --output <format>', 'Output format (text, json, yaml)', 'text')
  .action(async (id, options) => {
    const { deleteSnapshot } = await import('./commands/snapshot/delete.js');
    deleteSnapshot(id, options);
  });

// Blueprint commands
const blueprint = program
  .command('blueprint')
  .description('Manage blueprints')
  .alias('bp');

blueprint
  .command('list')
  .description('List all blueprints')
  .option('-o, --output <format>', 'Output format (text, json, yaml)', 'text')
  .action(async (options) => {
    const { listBlueprints } = await import('./commands/blueprint/list.js');
    listBlueprints(options);
  });

// Check if API key is configured (except for auth command)
const args = process.argv.slice(2);
if (args[0] !== 'auth' && args[0] !== '--help' && args[0] !== '-h' && args.length > 0) {
  const config = getConfig();
  if (!config.apiKey) {
    console.error('\n❌ API key not configured. Run: rln auth\n');
    process.exit(1);
  }
}

program.parse();

# Runloop CLI

A beautiful, interactive CLI for managing Runloop devboxes built with Ink and TypeScript.

## Features

- 🎨 Beautiful terminal UI with colors and gradients
- ⚡ Fast and responsive with pagination
- 🔐 Secure API key management
- 📦 Manage devboxes, snapshots, and blueprints
- 🚀 Execute commands in devboxes
- 📤 Upload files to devboxes
- 🎯 Organized command structure with aliases

## Installation

```bash
npm install
npm run build
npm link
```

## Setup

First, configure your API key:

```bash
rln auth
```

Get your API key from [https://runloop.ai/settings](https://runloop.ai/settings)

## Usage

### Authentication

```bash
rln auth                    # Configure API key
```

### Devbox Commands

```bash
# Create devboxes
rln devbox create                           # Create with auto-generated name
rln devbox create --name my-devbox          # Create with custom name
rln devbox create --template nodejs         # Create from template
rln d create -n my-devbox                   # Short alias

# List devboxes (paginated)
rln devbox list                             # List all devboxes
rln devbox list --status running            # Filter by status
rln d list                                  # Short alias

# Execute commands
rln devbox exec <devbox-id> echo "Hello"    # Run a command
rln devbox exec <devbox-id> ls -la          # List files
rln d exec <id> <command>                   # Short alias

# Upload files
rln devbox upload <devbox-id> ./file.txt    # Upload to home
rln devbox upload <id> ./file.txt -p /path  # Upload to specific path
rln d upload <id> <file>                    # Short alias

# Delete devboxes
rln devbox delete <devbox-id>               # Shutdown a devbox
rln devbox rm <devbox-id>                   # Alias
rln d delete <id>                           # Short alias
```

### Snapshot Commands

```bash
# Create snapshots
rln snapshot create <devbox-id>             # Create snapshot
rln snapshot create <id> --name backup-1    # Create with name
rln snap create <id>                        # Short alias

# List snapshots (paginated)
rln snapshot list                           # List all snapshots
rln snapshot list --devbox <id>             # Filter by devbox
rln snap list                               # Short alias

# Delete snapshots
rln snapshot delete <snapshot-id>           # Delete snapshot
rln snapshot rm <snapshot-id>               # Alias
rln snap delete <id>                        # Short alias
```

### Blueprint Commands

```bash
# List blueprints
rln blueprint list                          # List blueprints (coming soon)
rln bp list                                 # Short alias
```

## Command Structure

The CLI is organized into command buckets:

- **`devbox` (alias: `d`)** - Manage devboxes
  - `create` - Create new devboxes
  - `list` - List devboxes with pagination
  - `exec` - Execute commands
  - `upload` - Upload files
  - `delete` (alias: `rm`) - Shutdown devboxes

- **`snapshot` (alias: `snap`)** - Manage snapshots
  - `create` - Create snapshots
  - `list` - List snapshots with pagination
  - `delete` (alias: `rm`) - Delete snapshots

- **`blueprint` (alias: `bp`)** - Manage blueprints
  - `list` - List blueprints (coming soon)

## Interactive Features

- **Pagination** - Lists show 10 items per page with keyboard navigation
  - `n` - Next page
  - `p` - Previous page
  - `q` - Quit
- **Beautiful UI** - Gradient text, colored borders, Unicode icons
- **Real-time Status** - Spinners and progress indicators
- **Summary Stats** - Count running, stopped, and total resources

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run CLI
npm start -- <command>
```

## Tech Stack

- [Ink](https://github.com/vadimdemedes/ink) - React for CLIs
- [Ink Gradient](https://github.com/sindresorhus/ink-gradient) - Gradient text
- [Ink Big Text](https://github.com/sindresorhus/ink-big-text) - ASCII art
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [@runloop/api-client](https://github.com/runloopai/api-client-ts) - Runloop API client
- TypeScript - Type safety
- [Figures](https://github.com/sindresorhus/figures) - Unicode symbols

## License

MIT

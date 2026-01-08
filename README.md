# Runloop CLI

A beautiful, interactive CLI for managing Runloop devboxes built with Ink and TypeScript.

## Features

- 🎨 Beautiful terminal UI with colors and gradients
- ⚡ Fast and responsive with pagination
- 📦 Manage devboxes, snapshots, and blueprints
- 🚀 Execute commands in devboxes
- 📤 Upload files to devboxes
- 🎯 Organized command structure with aliases
- 🤖 **Model Context Protocol (MCP) server for AI integration**

## Installation

Install globally via npm:

```bash
npm install -g @runloop/rl-cli
```

Or install from source:

```bash
git clone https://github.com/runloop/rl-cli-node.git
cd rl-cli-node
npm install
npm run build
npm link
```

## Setup

Configure your API key:

```bash
export RUNLOOP_API_KEY=your_api_key_here
```

Get your API key from [https://runloop.ai/settings](https://runloop.ai/settings)

## Usage

### Theme Configuration

The CLI supports both light and dark terminal themes. Set the theme via environment variable:

```bash
export RUNLOOP_THEME=light   # Force light mode (dark text on light background)
export RUNLOOP_THEME=dark    # Force dark mode (light text on dark background)
```

**How it works:**

- **auto** (default): Uses dark mode by default
- **light**: Optimized for light-themed terminals (uses dark text colors)
- **dark**: Optimized for dark-themed terminals (uses light text colors)

### Devbox Commands

```bash
# Create devboxes
rli devbox create                           # Create with auto-generated name
rli devbox create --name my-devbox          # Create with custom name
rli devbox create --template nodejs         # Create from template
rli d create -n my-devbox                   # Short alias

# List devboxes (paginated)
rli devbox list                             # List all devboxes
rli devbox list --status running            # Filter by status
rli d list                                  # Short alias

# Execute commands
rli devbox exec <devbox-id> echo "Hello"    # Run a command
rli devbox exec <devbox-id> ls -la          # List files
rli d exec <id> <command>                   # Short alias

# Upload files
rli devbox upload <devbox-id> ./file.txt    # Upload to home
rli devbox upload <id> ./file.txt -p /path  # Upload to specific path
rli d upload <id> <file>                    # Short alias

# Delete devboxes
rli devbox delete <devbox-id>               # Shutdown a devbox
rli devbox rm <devbox-id>                   # Alias
rli d delete <id>                           # Short alias
```

### Snapshot Commands

```bash
# Create snapshots
rli snapshot create <devbox-id>             # Create snapshot
rli snapshot create <id> --name backup-1    # Create with name
rli snap create <id>                        # Short alias

# List snapshots (paginated)
rli snapshot list                           # List all snapshots
rli snapshot list --devbox <id>             # Filter by devbox
rli snap list                               # Short alias

# Delete snapshots
rli snapshot delete <snapshot-id>           # Delete snapshot
rli snapshot rm <snapshot-id>               # Alias
rli snap delete <id>                        # Short alias
```

### Blueprint Commands

```bash
# List blueprints
rli blueprint list                          # List blueprints (coming soon)
rli bp list                                 # Short alias
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

- **`mcp`** - Model Context Protocol server for AI integration
  - `install` - Install MCP configuration in Claude Desktop
  - `start` - Start the MCP server (stdio or HTTP mode)

## MCP Server (AI Integration)

Runloop includes a Model Context Protocol (MCP) server that allows AI assistants like Claude to interact with your devboxes.

### Quick Setup for Claude Desktop

```bash
# Install MCP configuration
rli mcp install

# Restart Claude Desktop, then ask Claude:
# "List my devboxes" or "Create a new devbox"
```

### Starting the Server

```bash
# Stdio mode (for Claude Desktop)
rli mcp start

# HTTP mode (for web/remote access)
rli mcp start --http
rli mcp start --http --port 8080
```

**Documentation:**
- [CLAUDE_SETUP.md](./CLAUDE_SETUP.md) - Complete setup guide for Claude Desktop
- [MCP_README.md](./MCP_README.md) - Full MCP documentation
- [MCP_COMMANDS.md](./MCP_COMMANDS.md) - Quick command reference

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

## Publishing

To publish a new version to npm:

```bash
npm run build
npm publish
```

**Note:** Make sure you're logged in to npm with access to the `@runloop` organization.

## License

MIT

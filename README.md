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

Configure your API key using either method:

### Option 1: Environment Variable (Recommended for CI/CD)

```bash
export RUNLOOP_API_KEY=your_api_key_here
```

### Option 2: Interactive Setup

```bash
rli auth
```

Get your API key from [https://runloop.ai/settings](https://runloop.ai/settings)

## Usage

### Authentication

```bash
# Interactive setup (stores API key locally)
rli auth

# Or use environment variable
export RUNLOOP_API_KEY=your_api_key_here
```

The CLI will automatically use `RUNLOOP_API_KEY` if set, otherwise it will use the stored configuration.

### Theme Configuration

The CLI supports both light and dark terminal themes with automatic detection:

```bash
# Interactive theme selector with live preview
rli config theme

# Or set theme directly
rli config theme auto    # Auto-detect terminal background (default)
rli config theme light   # Force light mode (dark text on light background)
rli config theme dark    # Force dark mode (light text on dark background)

# Or use environment variable
export RUNLOOP_THEME=light
```

**Interactive Mode:**

- When you run `rli config theme` without arguments, you get an interactive selector
- Use arrow keys to navigate between auto/light/dark options
- See live preview of colors as you navigate
- Press Enter to save, Esc to cancel

**How it works:**

- **auto** (default): Uses dark mode by default (theme detection is disabled to prevent terminal flashing)
- **light**: Optimized for light-themed terminals (uses dark text colors)
- **dark**: Optimized for dark-themed terminals (uses light text colors)

**Terminal Compatibility:**

- Works with all modern terminals (iTerm2, Terminal.app, VS Code integrated terminal, tmux)
- The CLI defaults to dark mode for the best experience
- You can manually set light or dark mode based on your terminal theme

**Note on Auto-Detection:**

- Auto theme detection is **disabled by default** to prevent screen flashing
- To enable it, set `RUNLOOP_ENABLE_THEME_DETECTION=1`
- If you use a light terminal, we recommend setting: `rli config theme light`
- The result is cached, so subsequent runs are instant (no flashing!)
- If you change your terminal theme, you can re-detect by running:

  ```bash
  rli config theme auto
  ```
- To manually set your theme without detection:
  ```bash
  export RUNLOOP_THEME=dark  # or light
  # Or disable auto-detection entirely:
  export RUNLOOP_DISABLE_THEME_DETECTION=1
  ```

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

## Tech Stack

- [Ink](https://github.com/vadimdemedes/ink) - React for CLIs
- [Ink Gradient](https://github.com/sindresorhus/ink-gradient) - Gradient text
- [Ink Big Text](https://github.com/sindresorhus/ink-big-text) - ASCII art
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [@runloop/api-client](https://github.com/runloopai/api-client-ts) - Runloop API client
- TypeScript - Type safety
- [Figures](https://github.com/sindresorhus/figures) - Unicode symbols

## Publishing

To publish a new version to npm:

```bash
npm run build
npm publish
```

**Note:** Make sure you're logged in to npm with access to the `@runloop` organization.

## License

MIT

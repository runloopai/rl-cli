# Runloop CLI

[![npm version](https://img.shields.io/npm/v/@runloop/rl-cli)](https://www.npmjs.com/package/@runloop/rl-cli)
[![CI](https://github.com/runloopai/rl-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/runloopai/rl-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A **TUI + CLI** for the [Runloop.ai](https://runloop.ai) platform. Use it as an **interactive TUI** (Terminal User Interface) with rich UI components, or as a **traditional CLI** for scripting and automation.

📖 **[Full Documentation](https://docs.runloop.ai/docs/tools/rl-cli)**

<p align="center">
  <img src="https://raw.githubusercontent.com/runloopai/rl-cli/main/misc/demo.gif" alt="Runloop CLI Demo" width="800">
</p>

## Quick Example

```bash
# TUI mode - launches an interactive terminal UI
rli

# CLI mode - perfect for scripts and automation
rli devbox list                    # Outputs JSON/text
rli devbox create --name my-devbox
rli devbox exec <devbox-id> echo "Hello World"
rli devbox delete <devbox-id>
```

## Features

- 🖥️ **TUI mode** — Interactive terminal UI with menus, tables, and real-time updates
- 🎯 **CLI mode** — Traditional commands with text, JSON, and YAML output for scripting
- ⚡ Fast and responsive with pagination
- 📦 Manage devboxes, snapshots, and blueprints
- 🚀 Execute commands, SSH, view logs in devboxes
- 🤖 **Model Context Protocol (MCP) server for AI integration**

## Installation

Install globally via npm or pnpm:

```bash
npm install -g @runloop/rl-cli
# or
pnpm add -g @runloop/rl-cli
```

## Setup

Configure your API key:

```bash
export RUNLOOP_API_KEY=your_api_key_here
```

Get your API key from [https://runloop.ai/settings](https://runloop.ai/settings)

## Usage

### TUI (Interactive Mode)

```bash
rli                    # Launch the interactive TUI
rli --help             # See help information
```

### CLI (Scripting Mode)

All commands support `--output` (`-o`) for format control:

```bash
rli devbox list                      # Default text output
rli devbox list -o json              # JSON output
rli devbox list -o yaml              # YAML output
```

## Command Structure

The CLI is organized into command buckets:

### Devbox Commands (alias: `d`)

```bash
rli devbox create                        # Create a new devbox
rli devbox list                          # List all devboxes
rli devbox delete <id>                   # Shutdown a devbox
rli devbox exec <id> <command...>        # Execute a command in a devbox
rli devbox exec-async <id> <command...>  # Execute a command asynchronously on a...
rli devbox upload <id> <file>            # Upload a file to a devbox
rli devbox get <id>                      # Get devbox details
rli devbox get-async <id> <execution-id> # Get status of an async execution
rli devbox suspend <id>                  # Suspend a devbox
rli devbox resume <id>                   # Resume a suspended devbox
rli devbox shutdown <id>                 # Shutdown a devbox
rli devbox ssh <id>                      # SSH into a devbox
rli devbox scp <src> <dst>               # Copy files to/from a devbox using scp...
rli devbox rsync <id> <src> <dst>        # Sync files to/from a devbox using rsync
rli devbox tunnel <id> <ports>           # Create a port-forwarding tunnel to a ...
rli devbox read <id>                     # Read a file from a devbox using the API
rli devbox write <id>                    # Write a file to a devbox using the API
rli devbox download <id>                 # Download a file from a devbox
rli devbox send-stdin <id> <execution-id> # Send stdin to a running async execution
rli devbox logs <id>                     # View devbox logs
```

### Snapshot Commands (alias: `snap`)

```bash
rli snapshot list                        # List all snapshots
rli snapshot create <devbox-id>          # Create a snapshot of a devbox
rli snapshot delete <id>                 # Delete a snapshot
rli snapshot get <id>                    # Get snapshot details
rli snapshot status <snapshot-id>        # Get snapshot operation status
```

### Blueprint Commands (alias: `bp`)

```bash
rli blueprint list                       # List all blueprints
rli blueprint create                     # Create a new blueprint
rli blueprint get <name-or-id>           # Get blueprint details by name or ID (...
rli blueprint logs <name-or-id>          # Get blueprint build logs by name or I...
rli blueprint prune <name>               # Delete old blueprint builds, keeping ...
rli blueprint from-dockerfile            # Create a blueprint from a Dockerfile ...
```

### Object Commands (alias: `obj`)

```bash
rli object list                          # List objects
rli object get <id>                      # Get object details
rli object download <id> <path>          # Download object to local file
rli object upload <path>                 # Upload a file as an object
rli object delete <id>                   # Delete an object (irreversible)
```

### Network-policy Commands (alias: `np`)

```bash
rli network-policy list                  # List network policies
rli network-policy get <id>              # Get network policy details
rli network-policy create                # Create a new network policy
rli network-policy delete <id>           # Delete a network policy
```

### Secret Commands (alias: `s`)

```bash
rli secret create <name>                 # Create a new secret. Value can be pip...
rli secret list                          # List all secrets
rli secret get <name>                    # Get secret metadata by name
rli secret update <name>                 # Update a secret value (value from std...
rli secret delete <name>                 # Delete a secret
```

### Gateway-config Commands (alias: `gwc`)

```bash
rli gateway-config list                  # List gateway configurations
rli gateway-config create                # Create a new gateway configuration
rli gateway-config get <id>              # Get gateway configuration details
rli gateway-config update <id>           # Update a gateway configuration
rli gateway-config delete <id>           # Delete a gateway configuration
```

### Mcp Commands

```bash
rli mcp start                            # Start the MCP server
rli mcp install                          # Install Runloop MCP server configurat...
```


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

## Theme Configuration

The TUI supports both light and dark terminal themes and will automatically select the appropriate theme.

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Watch mode
pnpm run dev

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

MIT

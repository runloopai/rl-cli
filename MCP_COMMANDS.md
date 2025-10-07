# Runloop MCP Commands Reference

Quick reference for all Runloop MCP commands.

## Installation

### Install MCP in Claude Desktop

Automatically configure Claude Desktop to use Runloop MCP:

```bash
rln mcp install
```

This command:
- Finds your Claude Desktop config file automatically
- Adds Runloop MCP server configuration
- Preserves existing MCP servers
- Prompts before overwriting existing Runloop configuration

After running this, restart Claude Desktop.

## Starting the MCP Server

### Stdio Mode (for Claude Desktop)

Start the MCP server in stdio mode:

```bash
rln mcp start
```

This mode is used by Claude Desktop and other local AI assistants. The server communicates via stdin/stdout.

### HTTP Mode (for remote/web access)

Start the MCP server in HTTP mode:

```bash
rln mcp start --http
```

This starts an HTTP server on port 3000 by default, using Server-Sent Events (SSE) for communication.

### HTTP Mode with Custom Port

Start the HTTP server on a specific port:

```bash
rln mcp start --http --port 8080
```

## Configuration File Format

When you run `rln mcp install`, it creates this configuration in your Claude Desktop config:

```json
{
  "mcpServers": {
    "runloop": {
      "command": "rln",
      "args": ["mcp", "start"]
    }
  }
}
```

### With Environment Variables

To use the development environment:

```json
{
  "mcpServers": {
    "runloop": {
      "command": "rln",
      "args": ["mcp", "start"],
      "env": {
        "RUNLOOP_ENV": "dev"
      }
    }
  }
}
```

## Available Tools

Once configured, Claude can use these tools:

### Devbox Management
- `list_devboxes` - List all devboxes
- `get_devbox` - Get devbox details
- `create_devbox` - Create a new devbox
- `execute_command` - Run commands on a devbox
- `shutdown_devbox` - Shutdown a devbox
- `suspend_devbox` - Suspend a devbox
- `resume_devbox` - Resume a devbox

### Blueprint Management
- `list_blueprints` - List available blueprints

### Snapshot Management
- `list_snapshots` - List all snapshots
- `create_snapshot` - Create a snapshot

## Example Usage

Once set up, you can ask Claude:

```
"List all my devboxes"
"Create a new devbox called 'test-server'"
"Execute 'python --version' on devbox abc123"
"What blueprints are available?"
"Create a snapshot of my devbox"
```

## Testing

Test the stdio server manually:

```bash
rln mcp start
```

You should see: `Runloop MCP server running on stdio`

Test the HTTP server:

```bash
rln mcp start --http
```

You should see:
```
Runloop MCP HTTP server running on http://localhost:3000
SSE endpoint: http://localhost:3000/sse
Message endpoint: http://localhost:3000/message
```

## Common Issues

### Command not found

If you get "command not found: rln":
- Install globally: `npm install -g @runloop/rl-cli`
- Check your PATH includes npm global bin directory

### API key not configured

Run `rln auth` before using the MCP server.

### Port already in use

For HTTP mode, use a different port:
```bash
rln mcp start --http --port 8080
```

## See Also

- [CLAUDE_SETUP.md](./CLAUDE_SETUP.md) - Detailed setup guide for Claude Desktop
- [MCP_README.md](./MCP_README.md) - Complete MCP documentation

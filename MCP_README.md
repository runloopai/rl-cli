# Runloop MCP Server

This CLI includes a Model Context Protocol (MCP) server that allows AI assistants like Claude to interact with your Runloop devboxes programmatically.

## What is MCP?

The Model Context Protocol (MCP) is an open standard that enables AI applications to connect with external systems. It's like a USB-C port for AI applications - a standardized way to expose tools, resources, and context to large language models.

## Starting the MCP Server

Runloop provides two transport modes for the MCP server:

### Stdio Mode (Default - Local Usage)

For local AI assistants like Claude Desktop:

```bash
rli mcp start
```

The server runs on stdio and communicates using the MCP protocol.

### HTTP Mode (Remote Access)

For web-based AI assistants or remote access:

```bash
rli mcp start --http
```

Or specify a custom port:

```bash
rli mcp start --http --port 8080
```

The HTTP server runs on `http://localhost:3000` by default and uses Server-Sent Events (SSE) for communication.

## Available Tools

The MCP server exposes the following tools:

### Devbox Management

- **list_devboxes** - List all devboxes with optional status filtering
  - Parameters: `status` (optional), `limit` (optional)

- **get_devbox** - Get detailed information about a specific devbox
  - Parameters: `id` (required)

- **create_devbox** - Create a new devbox
  - Parameters: `name`, `blueprint_id`, `snapshot_id`, `entrypoint`, `environment_variables`, `resource_size`, `keep_alive_seconds`

- **execute_command** - Execute a command on a devbox
  - Parameters: `devbox_id` (required), `command` (required)

- **shutdown_devbox** - Shutdown a devbox
  - Parameters: `id` (required)

- **suspend_devbox** - Suspend a devbox
  - Parameters: `id` (required)

- **resume_devbox** - Resume a suspended devbox
  - Parameters: `id` (required)

### Blueprint Management

- **list_blueprints** - List all available blueprints
  - Parameters: `limit` (optional)

### Snapshot Management

- **list_snapshots** - List all snapshots
  - Parameters: `devbox_id` (optional), `limit` (optional)

- **create_snapshot** - Create a snapshot of a devbox
  - Parameters: `devbox_id` (required), `name` (optional)

## Configuration

### Quick Install for Claude Desktop

The easiest way to set up with Claude Desktop:

```bash
rli mcp install
```

This automatically adds the configuration to your Claude Desktop config file and preserves any existing MCP servers.

### Manual Configuration for Claude Desktop (Stdio)

If you prefer to configure manually, add this to your Claude configuration file:

**macOS/Linux:** Edit `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** Edit `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "runloop": {
      "command": "rli",
      "args": ["mcp", "start"],
      "env": {
        "RUNLOOP_ENV": "prod"
      }
    }
  }
}
```

### Configuring Web Clients (HTTP)

For web-based AI clients, start the HTTP server and configure your client to connect to:

- **SSE endpoint:** `http://localhost:3000/sse`
- **Message endpoint:** `http://localhost:3000/message`

Example for Claude Code or other MCP clients supporting HTTP:

```json
{
  "mcpServers": {
    "runloop": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

## Authentication

The MCP server uses the same API key configuration as the CLI. Set your API key:

```bash
export RUNLOOP_API_KEY=your_api_key_here
```

## Example Usage with Claude

Once configured, you can ask Claude to perform Runloop operations:

- "List all my running devboxes"
- "Create a new devbox using the python-base blueprint"
- "Execute 'ls -la' on devbox abc123"
- "Show me all snapshots"
- "Create a snapshot of my devbox"

Claude will use the MCP tools to interact with your Runloop account and provide responses based on the actual data.

## Environment Variables

- `RUNLOOP_ENV` - Set to `dev` for development environment, `prod` (or leave unset) for production
- API key is read from the CLI configuration (~/.config/rli/config.json)

## Troubleshooting

### Stdio Server

If the stdio MCP server isn't working:

1. Make sure `RUNLOOP_API_KEY` environment variable is set
2. Check that the `rli` command is in your PATH
3. Restart Claude Desktop after updating the configuration
4. Check Claude's logs for any error messages

### HTTP Server

If the HTTP MCP server isn't working:

1. Make sure `RUNLOOP_API_KEY` environment variable is set
2. Check that the port isn't already in use
3. Verify the server is running: `curl http://localhost:3000/sse`
4. Check your firewall settings if connecting remotely
5. Look at the server logs for error messages

### Common Issues

- **"API key not configured"**: Set `RUNLOOP_API_KEY` environment variable
- **Port already in use**: Stop other services or use a different port with `--port`
- **Connection refused**: Make sure the server is running and accessible

## Security Note

The MCP server provides full access to your Runloop account. Only use it with trusted AI assistants, and be aware that the assistant can create, modify, and delete devboxes on your behalf.

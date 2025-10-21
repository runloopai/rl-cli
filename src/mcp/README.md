# Runloop MCP Server Package

This directory contains a self-contained Model Context Protocol (MCP) server for Runloop devbox management, packaged as an `.mcpb` bundle for distribution with Claude Desktop.

## Overview

The MCP server provides AI assistants (like Claude) with tools to interact with Runloop devboxes, including:
- Creating and managing devboxes
- Executing commands on devboxes
- Managing blueprints and snapshots
- Controlling devbox lifecycle (start, stop, suspend, resume)

## Directory Structure

```
src/mcp/
├── README.md              # This file
├── manifest.json          # MCPB manifest configuration
├── package.json           # Node.js dependencies
├── tsconfig.json          # TypeScript configuration
├── server/                # Server implementation
│   └── index.ts           # Main MCP server (stdio transport)
├── server-http.ts         # HTTP/SSE server implementation
├── utils -> ../utils      # Symlink to shared utilities
├── dist/                  # Compiled JavaScript files
├── node_modules/          # Bundled dependencies
└── *.mcpb                 # Generated MCPB packages (ignored by git)
```

## Prerequisites

1. **Node.js**: Version 18.0.0 or higher
2. **MCPB CLI**: Install globally with `npm install -g @anthropic/mcpb`
3. **TypeScript**: Included as dev dependency
4. **Runloop API Key**: Configure with `rli auth`

## Building the MCPB Package

### Step 1: Install Dependencies

```bash
cd src/mcp
npm install
```

This installs the minimal required dependencies:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `@runloop/api-client` - Runloop API client
- `conf` - Configuration management

### Step 2: Build TypeScript

```bash
npm run build
```

This compiles TypeScript files to JavaScript in the `dist/` directory:
- `dist/server/index.js` - Main MCP server
- `dist/server-http.js` - HTTP/SSE server
- `dist/utils/*.js` - Utility functions

### Step 3: Package as MCPB

```bash
mcpb pack
```

This creates a self-contained `.mcpb` package that includes:
- All compiled JavaScript files
- Bundled `node_modules` dependencies
- `manifest.json` configuration
- Total package size: ~7.7MB

## Package Contents

The generated `.mcpb` file contains:

### Core Files
- `manifest.json` - MCPB metadata and server configuration
- `dist/server/index.js` - Main MCP server entry point
- `dist/utils/*.js` - Utility functions (client, config, etc.)

### Dependencies (~2,646 files)
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `@runloop/api-client` - Runloop API integration
- `conf` - Configuration management
- All transitive dependencies

## Available Tools

The MCP server exposes 10 tools:

### Devbox Management
- `list_devboxes` - List all devboxes with optional filtering
- `get_devbox` - Get detailed devbox information
- `create_devbox` - Create a new devbox
- `execute_command` - Execute commands on devboxes
- `shutdown_devbox` - Shutdown a devbox
- `suspend_devbox` - Suspend a devbox
- `resume_devbox` - Resume a suspended devbox

### Blueprint Management
- `list_blueprints` - List available blueprints

### Snapshot Management
- `list_snapshots` - List all snapshots
- `create_snapshot` - Create a snapshot of a devbox

## Installation and Usage

For detailed information on installing and using the MCP server with Claude Desktop, see:

- **[MCP_COMMANDS.md](../../MCP_COMMANDS.md)** - Quick reference for MCP commands and installation
- **[MCP_README.md](../../MCP_README.md)** - Complete MCP documentation and usage guide

## Development

### Testing the Server

**Stdio Mode (for Claude Desktop):**
```bash
rli mcp start
```

**HTTP Mode (for web/remote access):**
```bash
rli mcp start --http --port 3000
```

### Manual Testing
```bash
# Test stdio server
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | node dist/server/index.js

# Test HTTP server
node dist/server-http.js
curl http://localhost:3000/sse
```

## Configuration

### Environment Variables
- `RUNLOOP_ENV` - Set to "dev" for development environment (default: "prod")
- `RUNLOOP_API_KEY` - API key (configured via `rli auth`)

### API Endpoints
- **Production**: `https://api.runloop.ai`
- **Development**: `https://api.runloop.pro`

## Troubleshooting

### Common Issues

1. **"API key not configured"**
   ```bash
   rli auth
   ```

2. **"Command not found: rli"**
   ```bash
   npm install -g @runloop/rl-cli
   ```

3. **Build errors**
   ```bash
   cd src/mcp
   npm install
   npm run build
   ```

4. **MCPB validation errors**
   ```bash
   mcpb validate
   ```

### Debugging

Enable debug logging:
```bash
DEBUG=* rli mcp start
```

## File Generation

The following files are generated during the build process and should not be committed:
- `*.mcpb` - MCPB package files
- `dist/` - Compiled JavaScript files
- `node_modules/` - Dependencies

These are automatically ignored by `.gitignore`.

## Version History

- **v1.0.0** - Initial MCPB package with all 10 tools
- Self-contained package with bundled dependencies
- Support for both stdio and HTTP/SSE transports

## Support

For issues with the MCP server:
1. Check the troubleshooting section above
2. Verify API key configuration with `rli auth`
3. Test server manually with `rli mcp start`
4. Check Claude Desktop logs for errors

For Runloop API issues, contact support at support@runloop.com.

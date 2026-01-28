# Runloop MCP Server

MCP (Model Context Protocol) server for managing Runloop devboxes.

## Building the MCP Extension

To build the `.mcpb` bundle:

```bash
pnpm run build:mcp
```

This will:
1. Compile TypeScript files to `dist/mcp/`
2. Bundle `dist/mcp/server.js` with all dependencies into `src/mcp/index.js`
3. Create `runloop-mcp-server.mcpb` in the project root

The resulting `.mcpb` file is a zip archive containing:
- `index.js` - Bundled server code with all dependencies (~850KB minified)
- `manifest.json` - MCP extension metadata

**Bundle size:** ~0.21MB (vs 16MB+ with node_modules)

## Source Files

- `server.ts` - Main MCP server implementation with stdio transport (standalone, includes all client configuration)
- `server-http.ts` - HTTP/SSE transport variant (not used in bundle)
- `index.js` - Generated bundle (tracked in git)
- `manifest.json` - MCP extension metadata (tracked in git)

## Build Process

The build process is defined in `scripts/build-mcp.js`:
1. Uses esbuild to bundle all dependencies into a single minified file in `src/mcp/`
2. Copies manifest.json to the bundle
3. Creates a compressed .mcpb archive with only required files
4. All generated files are tracked in git for easy distribution

## Installing the Extension

Install the `.mcpb` file in your MCP-compatible client (e.g., Claude Desktop).

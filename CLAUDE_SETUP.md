# Setting Up Runloop MCP with Claude

This guide will walk you through connecting the Runloop MCP server to Claude Desktop.

## Prerequisites

1. Make sure you have Claude Desktop installed
2. Set your API key: `export RUNLOOP_API_KEY=your_api_key_here`
3. Make sure `rli` is installed globally and in your PATH

## Quick Setup (Automatic)

The easiest way to set up Runloop with Claude Desktop:

```bash
rli mcp install
```

This command will:
- Automatically find your Claude Desktop configuration file
- Add the Runloop MCP server configuration
- Preserve any existing MCP servers you have configured

Then just restart Claude Desktop and you're ready to go!

## Manual Setup

If you prefer to set it up manually or the automatic install doesn't work:

### 1. Find Your Claude Configuration File

The location depends on your operating system:

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### 2. Edit the Configuration File

If the file doesn't exist, create it. Add or update it with this configuration:

```json
{
  "mcpServers": {
    "runloop": {
      "command": "rli",
      "args": ["mcp", "start"]
    }
  }
}
```

**If you already have other MCP servers configured**, just add the runloop entry to the existing `mcpServers` object:

```json
{
  "mcpServers": {
    "existing-server": {
      "command": "some-command",
      "args": ["some-args"]
    },
    "runloop": {
      "command": "rli",
      "args": ["mcp", "start"]
    }
  }
}
```

### 3. Restart Claude Desktop

Close and reopen Claude Desktop completely for the changes to take effect.

### 4. Verify It's Working

In Claude Desktop, you should now be able to ask Claude to interact with your Runloop account:

**Try these example prompts:**

- "Can you list all my devboxes?"
- "Show me my running devboxes"
- "Create a new devbox called 'test-env'"
- "What blueprints are available?"
- "Execute 'pwd' on devbox [your-devbox-id]"

Claude will now have access to these Runloop tools and can manage your devboxes!

## Troubleshooting

### "Command not found: rli"

Make sure `rli` is in your PATH. Test by running `which rli` (macOS/Linux) or `where rli` (Windows) in your terminal.

If not found:
- If installed via npm globally: `npm install -g @runloop/rl-cli`
- If installed via pnpm globally: `pnpm add -g @runloop/rl-cli`
- Check your npm/pnpm global bin directory is in PATH

### "API key not configured"

Set the `RUNLOOP_API_KEY` environment variable before using the MCP server.

### Claude doesn't show Runloop tools

1. Make sure you saved the config file correctly (valid JSON)
2. Restart Claude Desktop completely (quit, not just close window)
3. Check Claude's developer logs for errors:
   - **macOS:** `~/Library/Logs/Claude/`
   - **Windows:** `%APPDATA%\Claude\logs\`

### Testing the MCP server manually

You can test if the MCP server is working by running:

```bash
rli mcp start
```

It should output: `Runloop MCP server running on stdio`

Press Ctrl+C to stop it.

## Advanced Configuration

### Using Development Environment

If you want to connect to Runloop's development environment:

```json
{
  "mcpServers": {
    "runloop": {
      "command": "rli",
      "args": ["mcp", "start"],
      "env": {
        "RUNLOOP_ENV": "dev"
      }
    }
  }
}
```

### Using a Specific Path

If `rli` isn't in your PATH, you can specify the full path:

```json
{
  "mcpServers": {
    "runloop": {
      "command": "/full/path/to/rli",
      "args": ["mcp", "start"]
    }
  }
}
```

Find the full path with: `which rli` (macOS/Linux) or `where rli` (Windows)

## What Can Claude Do Now?

Once connected, Claude can:

- ✅ List all your devboxes
- ✅ Get detailed information about specific devboxes
- ✅ Create new devboxes
- ✅ Execute commands on devboxes
- ✅ Shutdown, suspend, and resume devboxes
- ✅ List available blueprints
- ✅ List and create snapshots

Claude will automatically use these tools when you ask questions about your Runloop infrastructure!

## Example Conversation

**You:** "What devboxes do I have running right now?"

**Claude:** *Uses the list_devboxes tool and shows you all running devboxes with their details*

**You:** "Create a new devbox called 'api-server' using the python-base blueprint"

**Claude:** *Uses the create_devbox tool with the specified parameters and confirms creation*

**You:** "Run 'python --version' on that new devbox"

**Claude:** *Uses the execute_command tool and shows you the output*

---

**Need help?** Open an issue at https://github.com/runloopai/rl-cli/issues

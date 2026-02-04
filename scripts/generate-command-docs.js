#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createProgram } from "../dist/utils/commands.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const readmePath = join(rootDir, "README.md");

// Default docs path - can be overridden via DOCS_PATH env var or --docs-path argument
const defaultDocsPath = join(rootDir, "..", "docs", "docs", "tools", "rl-cli.mdx");

/**
 * Generates markdown documentation for the command structure from Commander
 * in the format: code blocks with grouped examples
 */
function generateCommandStructure(program) {
  const lines = [];
  lines.push("## Command Structure");
  lines.push("");
  lines.push(
    "The CLI is organized into command buckets:",
  );
  lines.push("");

  // Get all top-level commands (excluding hidden ones)
  const commands = program.commands.filter((cmd) => !cmd._hidden);

  // Group names for better organization
  const groupNames = {
    create: "Create",
    list: "List",
    get: "Get",
    delete: "Delete",
    exec: "Execute commands",
    upload: "Upload files",
    download: "Download files",
    read: "Read files",
    write: "Write files",
    suspend: "Suspend",
    resume: "Resume",
    shutdown: "Shutdown",
    ssh: "SSH",
    scp: "Copy files (scp)",
    rsync: "Sync files (rsync)",
    tunnel: "Create tunnel",
    logs: "View logs",
    status: "Get status",
    install: "Install",
    start: "Start",
  };

  for (const command of commands) {
    const commandName = command.name();
    const commandAlias = command.aliases()[0] || null;
    const sectionTitleBase = commandName.charAt(0).toUpperCase() + commandName.slice(1) + " Commands";
    const sectionTitle = commandAlias 
      ? `${sectionTitleBase} (alias: \`${commandAlias}\`)`
      : sectionTitleBase;
    
    lines.push(`### ${sectionTitle}`);
    lines.push("");
    lines.push("```bash");

    // Get subcommands
    const subcommands = command.commands.filter((cmd) => !cmd._hidden);
    
    // Group subcommands by their base action
    const grouped = {};
    for (const subcmd of subcommands) {
      const baseName = subcmd.name().split("-")[0]; // e.g., "exec-async" -> "exec"
      if (!grouped[baseName]) {
        grouped[baseName] = [];
      }
      grouped[baseName].push(subcmd);
    }

    // Generate examples for each group
    for (const [groupName, cmds] of Object.entries(grouped)) {
      for (const subcmd of cmds) {
        // Build command signature
        const args = subcmd._args
          .map((arg) => {
            const isVariadic = arg.variadic || false;
            if (arg.required) {
              return `<${arg.name()}${isVariadic ? "..." : ""}>`;
            }
            return `[${arg.name()}${isVariadic ? "..." : ""}]`;
          })
          .join(" ");
        
        const cmdName = args ? `${subcmd.name()} ${args}` : subcmd.name();
        const fullCmd = `rli ${commandName} ${cmdName}`;
        
        // Get description, make it shorter for inline comments
        let desc = subcmd.description();
        if (desc.length > 40) {
          desc = desc.substring(0, 37) + "...";
        }
        
        lines.push(`${fullCmd.padEnd(40)} # ${desc}`);
        
        // Show subcommand alias if exists (but not if command itself has alias)
        if (subcmd.aliases().length > 0 && !commandAlias) {
          const aliasName = subcmd.aliases()[0];
          const aliasFullCmd = `rli ${commandName} ${aliasName} ${args}`.trim();
          lines.push(`${aliasFullCmd.padEnd(40)} # Alias`);
        }
      }
    }

    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generates a detailed command reference for external docs (rl-cli.mdx)
 * Uses Mintlify components for better presentation
 */
function generateDetailedCommandDocs(program) {
  const sections = [];
  
  // Get all top-level commands (excluding hidden ones)
  const commands = program.commands.filter((cmd) => !cmd._hidden);

  for (const command of commands) {
    const commandName = command.name();
    const commandAlias = command.aliases()[0] || null;
    const sectionTitleBase = commandName.charAt(0).toUpperCase() + commandName.slice(1);
    
    const lines = [];
    // Use simple header text for predictable anchor slugs (e.g., "devbox-commands")
    lines.push(`### ${sectionTitleBase} Commands`);
    lines.push("");
    lines.push("<AccordionGroup>");

    // Get subcommands
    const subcommands = command.commands.filter((cmd) => !cmd._hidden);

    for (const subcmd of subcommands) {
      // Build command signature
      const args = subcmd._args
        .map((arg) => {
          const isVariadic = arg.variadic || false;
          if (arg.required) {
            return `<${arg.name()}${isVariadic ? "..." : ""}>`;
          }
          return `[${arg.name()}${isVariadic ? "..." : ""}]`;
        })
        .join(" ");
      
      const cmdName = args ? `${subcmd.name()} ${args}` : subcmd.name();
      const fullCmd = `rli ${commandName} ${cmdName}`;
      
      // Get icon based on command type
      const icon = getCommandIcon(subcmd.name());
      
      lines.push(`  <Accordion title="${subcmd.name()}" icon="${icon}">`);
      lines.push(`    ${subcmd.description()}`);
      lines.push("");
      lines.push(`    \`\`\`bash`);
      lines.push(`    ${fullCmd}`);
      lines.push(`    \`\`\``);
      
      // Add options/parameters if any (excluding common output option)
      const options = subcmd.options.filter(opt => !opt.flags.includes("--output"));
      if (options.length > 0) {
        lines.push("");
        for (const opt of options) {
          const { name, type, isRequired } = parseOption(opt);
          const defaultAttr = opt.defaultValue !== undefined ? ` default="${opt.defaultValue}"` : "";
          const requiredAttr = isRequired || opt.mandatory ? " required" : "";
          lines.push(`    <ParamField query="${name}" type="${type}"${defaultAttr}${requiredAttr}>`);
          lines.push(`      ${opt.description}`);
          lines.push(`    </ParamField>`);
        }
      }
      
      lines.push("  </Accordion>");
    }
    
    lines.push("</AccordionGroup>");
    lines.push("");

    sections.push(lines.join("\n"));
  }

  return sections.join("\n");
}

/**
 * Parse option flags to extract name and type
 */
function parseOption(opt) {
  const flags = opt.flags;
  // Extract the long flag name (e.g., "--name <value>" -> "name")
  const longMatch = flags.match(/--([a-z-]+)/i);
  const name = longMatch ? longMatch[1] : flags;
  
  // Determine type from the flag pattern
  let type = "boolean";
  if (flags.includes("<") && flags.includes(">")) {
    // Has a value placeholder
    if (flags.includes("...>")) {
      type = "string[]";
    } else {
      type = "string";
    }
  }
  
  const isRequired = opt.mandatory || false;
  
  return { name, type, isRequired };
}

/**
 * Get an appropriate icon for a command based on its name
 */
function getCommandIcon(cmdName) {
  const iconMap = {
    create: "plus",
    list: "list",
    get: "eye",
    delete: "trash",
    exec: "terminal",
    "exec-async": "terminal",
    "get-async": "clock",
    "send-stdin": "keyboard",
    upload: "upload",
    download: "download",
    read: "file",
    write: "pencil",
    suspend: "pause",
    resume: "play",
    shutdown: "power-off",
    ssh: "terminal",
    scp: "copy",
    rsync: "rotate",
    tunnel: "network-wired",
    logs: "scroll",
    status: "info",
    start: "play",
    install: "download",
  };
  
  return iconMap[cmdName] || "code";
}

/**
 * Updates the README.md file with the generated command structure
 */
function updateReadme(newCommandStructure) {
  const readmeContent = readFileSync(readmePath, "utf-8");
  
  // Find the start and end of the Command Structure section
  const startMarker = "## Command Structure";
  const endMarker = "## MCP Server";
  
  const startIndex = readmeContent.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error("Could not find '## Command Structure' section in README.md");
  }
  
  // Find the end of the section (before the next ## heading)
  const afterStart = readmeContent.substring(startIndex);
  const endIndex = afterStart.indexOf(endMarker);
  if (endIndex === -1) {
    throw new Error("Could not find end marker '## MCP Server' in README.md");
  }
  
  // Extract the content before and after the section
  const before = readmeContent.substring(0, startIndex);
  const after = readmeContent.substring(startIndex + endIndex);
  
  // Combine with the new command structure
  const updatedContent = before + newCommandStructure + "\n\n" + after;
  
  writeFileSync(readmePath, updatedContent, "utf-8");
  console.log("✅ Updated README.md with generated command structure");
}

/**
 * Generates the full rl-cli.mdx content
 */
function generateCliMdx(program) {
  const commandDocs = generateDetailedCommandDocs(program);
  
  return `---
title: 'Runloop CLI'
description: 'Explore, experiment with, and test the Runloop API using the Runloop CLI.'
icon: 'terminal'
---

The Runloop CLI (\`rli\`) provides both an interactive terminal UI and traditional CLI commands for managing your Runloop resources.

<CardGroup cols={2}>
  <Card title="npm Package" icon="npm" href="https://www.npmjs.com/package/@runloop/rl-cli">
    @runloop/rl-cli
  </Card>
  <Card title="GitHub Repository" icon="github" href="https://github.com/runloopai/rl-cli">
    runloopai/rl-cli
  </Card>
</CardGroup>

## Installation

<CodeGroup>

\`\`\`bash npm
npm install -g @runloop/rl-cli
\`\`\`

\`\`\`bash yarn
yarn global add @runloop/rl-cli
\`\`\`

\`\`\`bash pnpm
pnpm add -g @runloop/rl-cli
\`\`\`

</CodeGroup>

## Setup

Configure your API key:

\`\`\`bash
export RUNLOOP_API_KEY=your_api_key_here
\`\`\`

<Tip>
  Get your API key from [runloop.ai/settings](https://runloop.ai/settings)
</Tip>

## Quick Start

<Tabs>
  <Tab title="Interactive Mode">
    Launch the interactive UI with a beautiful terminal interface:
    
    \`\`\`bash
    rli
    \`\`\`
    
    Navigate with arrow keys, select with Enter, and manage all your resources visually.
    
    <Frame>
      <img src="https://raw.githubusercontent.com/runloopai/rl-cli/main/misc/demo.gif" alt="Runloop CLI Interactive Mode" />
    </Frame>
    
    ### Search Devboxes
    
    Press \`/\` to search and filter through your devboxes by name or ID.
    
    <Frame>
      <img src="https://raw.githubusercontent.com/runloopai/rl-cli/main/misc/rli-demo-search.gif" alt="Search devboxes in interactive mode" />
    </Frame>
    
    ### SSH to Devbox
    
    From the interactive menu, select a devbox and choose **SSH** to open a secure shell session directly into your devbox. The CLI handles all the SSH key setup and connection details automatically.
    
    <Frame>
      <img src="https://raw.githubusercontent.com/runloopai/rl-cli/main/misc/rli-ssh-demo.gif" alt="SSH into a Devbox" />
    </Frame>
  </Tab>
  <Tab title="CLI Mode">
    Use traditional commands for scripting and automation:
    
    \`\`\`bash
    # List all devboxes
    rli devbox list --output json
    \`\`\`
    
    \`\`\`json Example Output
    [
      {
        "id": "dbx_1234567890",
        "name": "my-devbox",
        "status": "running",
        "blueprint_id": "bpt_abcdef"
      }
    ]
    \`\`\`
    
    \`\`\`bash
    # Create a new devbox
    rli devbox create --name my-devbox --blueprint my-blueprint
    \`\`\`
    
    \`\`\`text Example Output
    dbx_1234567890
    \`\`\`
    
    \`\`\`bash
    # Execute a command in a devbox
    rli devbox exec dbx_1234567890 echo "Hello World"
    \`\`\`
    
    \`\`\`text Example Output
    Hello World
    \`\`\`
    
    \`\`\`bash
    # SSH into a devbox
    rli devbox ssh dbx_1234567890
    \`\`\`
  </Tab>
</Tabs>

## Command Groups

<CardGroup cols={2}>
  <Card title="Devbox" icon="server" href="#devbox-commands">
    Create, manage, and interact with devboxes
  </Card>
  <Card title="Snapshot" icon="camera" href="#snapshot-commands">
    Create and manage devbox snapshots
  </Card>
  <Card title="Blueprint" icon="diagram-project" href="#blueprint-commands">
    Manage reusable devbox templates
  </Card>
  <Card title="Object" icon="box-archive" href="#object-commands">
    Upload and manage file objects
  </Card>
</CardGroup>

## Command Reference

${commandDocs}

## MCP Server (AI Integration)

<Note>
  The CLI includes a Model Context Protocol (MCP) server that allows AI assistants like Claude to interact with your devboxes.
</Note>

### Quick Setup for Claude Desktop

\`\`\`bash
# Install MCP configuration
rli mcp install
\`\`\`

After installation, restart Claude Desktop and ask Claude to "List my devboxes" or "Create a new devbox".

### Server Modes

<Tabs>
  <Tab title="Stdio (Claude Desktop)">
    \`\`\`bash
    rli mcp start
    \`\`\`
    
    Standard input/output mode for Claude Desktop integration.
  </Tab>
  <Tab title="HTTP (Web/Remote)">
    \`\`\`bash
    rli mcp start --http
    rli mcp start --http --port 8080
    \`\`\`
    
    HTTP/SSE mode for web applications and remote access.
  </Tab>
</Tabs>

## Output Formats

All commands support multiple output formats via the \`--output\` flag:

<ResponseField name="--output json" type="flag">
  JSON output for programmatic parsing
</ResponseField>

<ResponseField name="--output yaml" type="flag">
  YAML output for configuration files
</ResponseField>

<ResponseField name="--output text" type="flag">
  Plain text output for human readability
</ResponseField>

\`\`\`bash
rli devbox list --output json
rli devbox list --output yaml
rli devbox list --output text
\`\`\`

## Contributing

The Runloop CLI is open-source. We welcome contributions!

<CardGroup cols={2}>
  <Card title="GitHub Repository" icon="github" href="https://github.com/runloopai/rl-cli">
    View source code and submit PRs
  </Card>
  <Card title="Report Issues" icon="bug" href="https://github.com/runloopai/rl-cli/issues">
    Report bugs or request features
  </Card>
</CardGroup>
`;
}

/**
 * Updates the external docs rl-cli.mdx file
 */
function updateDocsMdx(program, docsPath) {
  if (!existsSync(docsPath)) {
    console.log(`⚠️  Docs file not found at ${docsPath}, skipping docs update`);
    console.log("   Set DOCS_PATH env var or use --docs-path to specify location");
    return false;
  }

  const newContent = generateCliMdx(program);
  writeFileSync(docsPath, newContent, "utf-8");
  console.log(`✅ Updated ${docsPath} with generated CLI documentation`);
  return true;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    docsPath: process.env.DOCS_PATH || defaultDocsPath,
    skipReadme: false,
    skipDocs: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--docs-path" && args[i + 1]) {
      options.docsPath = args[i + 1];
      i++;
    } else if (args[i] === "--skip-readme") {
      options.skipReadme = true;
    } else if (args[i] === "--skip-docs") {
      options.skipDocs = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`
Usage: generate-command-docs.js [options]

Options:
  --docs-path <path>  Path to rl-cli.mdx file (default: ../docs/docs/tools/rl-cli.mdx)
  --skip-readme       Skip updating README.md
  --skip-docs         Skip updating rl-cli.mdx
  --help, -h          Show this help message

Environment Variables:
  DOCS_PATH           Alternative way to specify docs path
`);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  try {
    const options = parseArgs();
    const program = createProgram();
    
    if (!options.skipReadme) {
      const markdown = generateCommandStructure(program);
      updateReadme(markdown);
    }

    if (!options.skipDocs) {
      updateDocsMdx(program, options.docsPath);
    }
  } catch (error) {
    console.error("Error generating command docs:", error);
    process.exit(1);
  }
}

main();

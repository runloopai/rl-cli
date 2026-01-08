#!/usr/bin/env node

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, writeFileSync } from "fs";
import { createProgram } from "../dist/utils/commands.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const readmePath = join(rootDir, "README.md");

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

async function main() {
  try {
    const program = createProgram();
    const markdown = generateCommandStructure(program);
    updateReadme(markdown);
  } catch (error) {
    console.error("Error generating command docs:", error);
    process.exit(1);
  }
}

main();

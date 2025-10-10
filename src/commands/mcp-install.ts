#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir, platform } from "os";
import { join } from "path";
import { execSync } from "child_process";

function getClaudeConfigPath(): string {
  const plat = platform();

  if (plat === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  } else if (plat === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error("APPDATA environment variable not found");
    }
    return join(appData, "Claude", "claude_desktop_config.json");
  } else {
    // Linux
    return join(homedir(), ".config", "Claude", "claude_desktop_config.json");
  }
}

function getRliPath(): string {
  try {
    const cmd = platform() === "win32" ? "where rli" : "which rli";
    const path = execSync(cmd, { encoding: "utf-8" }).trim().split("\n")[0];
    return path;
  } catch (error) {
    // If rli not found in PATH, just use 'rli' and hope it works
    return "rli";
  }
}

export async function installMcpConfig() {
  try {
    const configPath = getClaudeConfigPath();
    const rliPath = getRliPath();

    console.log(`\n📍 Claude Desktop config location: ${configPath}`);
    console.log(`📍 rli command location: ${rliPath}\n`);

    // Read or create config
    let config: any = { mcpServers: {} };

    if (existsSync(configPath)) {
      console.log("✓ Found existing Claude Desktop config");
      const content = readFileSync(configPath, "utf-8");
      try {
        config = JSON.parse(content);
        if (!config.mcpServers) {
          config.mcpServers = {};
        }
      } catch (error) {
        console.error(
          "❌ Error: Claude config file exists but is not valid JSON",
        );
        console.error(
          "Please fix the file manually or delete it to create a new one",
        );
        process.exit(1);
      }
    } else {
      console.log("✓ No existing config found, will create new one");
      // Create directory if it doesn't exist
      const configDir = join(configPath, "..");
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
        console.log(`✓ Created directory: ${configDir}`);
      }
    }

    // Check if runloop is already configured
    if (config.mcpServers.runloop) {
      console.log(
        "\n⚠️  Runloop MCP server is already configured in Claude Desktop",
      );
      console.log("\nCurrent configuration:");
      console.log(JSON.stringify(config.mcpServers.runloop, null, 2));

      // Ask if they want to overwrite
      console.log("\n❓ Do you want to overwrite it? (y/N): ");

      // For non-interactive mode, just exit
      if (process.stdin.isTTY) {
        const response = await new Promise<string>((resolve) => {
          process.stdin.once("data", (data) => {
            resolve(data.toString().trim().toLowerCase());
          });
        });

        if (response !== "y" && response !== "yes") {
          console.log("\n✓ Keeping existing configuration");
          process.exit(0);
        }
      } else {
        console.log(
          "\n✓ Keeping existing configuration (non-interactive mode)",
        );
        process.exit(0);
      }
    }

    // Add runloop MCP server config
    config.mcpServers.runloop = {
      command: rliPath,
      args: ["mcp", "start"],
    };

    // Write config back
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    console.log(
      "\n✅ Successfully installed Runloop MCP server configuration!",
    );
    console.log("\nConfiguration added:");
    console.log(
      JSON.stringify(
        { mcpServers: { runloop: config.mcpServers.runloop } },
        null,
        2,
      ),
    );

    console.log("\n📝 Next steps:");
    console.log("1. Restart Claude Desktop completely (quit and reopen)");
    console.log(
      '2. Ask Claude: "List my devboxes" or "What Runloop tools do you have?"',
    );
    console.log(
      '\n💡 Tip: Make sure you\'ve run "rli auth" to configure your API key first!',
    );
  } catch (error: any) {
    console.error("\n❌ Error installing MCP configuration:", error.message);
    console.error(
      "\n💡 You can manually add this configuration to your Claude Desktop config:",
    );
    console.error(`\nFile location: ${getClaudeConfigPath()}`);
    console.error("\nConfiguration to add:");
    console.error(
      JSON.stringify(
        {
          mcpServers: {
            runloop: {
              command: "rli",
              args: ["mcp", "start"],
            },
          },
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

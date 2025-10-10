#!/usr/bin/env node

import { Command } from "commander";
import { createDevbox } from "./commands/devbox/create.js";
import { listDevboxes } from "./commands/devbox/list.js";
import { deleteDevbox } from "./commands/devbox/delete.js";
import { execCommand } from "./commands/devbox/exec.js";
import { uploadFile } from "./commands/devbox/upload.js";
import { getConfig } from "./utils/config.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf8"),
);
export const VERSION = packageJson.version;

// Global Ctrl+C handler to ensure it always exits
process.on("SIGINT", () => {
  // Force exit immediately, clearing alternate screen buffer
  process.stdout.write("\x1b[?1049l");
  process.stdout.write("\n");
  process.exit(130); // Standard exit code for SIGINT
});

const program = new Command();

program
  .name("rli")
  .description("Beautiful CLI for Runloop devbox management")
  .version(VERSION);

program
  .command("auth")
  .description("Configure API authentication")
  .action(async () => {
    const { default: auth } = await import("./commands/auth.js");
    auth();
  });

program
  .command("check-updates")
  .description("Check for CLI updates")
  .action(async () => {
    const { checkForUpdates } = await import("./utils/config.js");
    console.log("Checking for updates...");
    await checkForUpdates(true);
  });

// Devbox commands
const devbox = program
  .command("devbox")
  .description("Manage devboxes")
  .alias("d")
  .action(async () => {
    // Open interactive devbox list when no subcommand provided
    const { runInteractiveCommand } = await import(
      "./utils/interactiveCommand.js"
    );
    const { listDevboxes } = await import("./commands/devbox/list.js");
    await runInteractiveCommand(() => listDevboxes({ output: "interactive" }));
  });

devbox
  .command("create")
  .description("Create a new devbox")
  .option("-n, --name <name>", "Devbox name")
  .option("-t, --template <template>", "Template to use")
  .option("--blueprint <blueprint>", "Blueprint ID to use")
  .option(
    "--resources <size>",
    "Resource size (X_SMALL, SMALL, MEDIUM, LARGE, X_LARGE, XX_LARGE)",
  )
  .option("--architecture <arch>", "Architecture (arm64, x86_64)")
  .option("--entrypoint <command>", "Entrypoint command to run")
  .option("--available-ports <ports...>", "Available ports")
  .option("--root", "Run as root")
  .option("--user <user:uid>", "Run as this user (format: username:uid)")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(createDevbox);

devbox
  .command("list")
  .description("List all devboxes")
  .option("-s, --status <status>", "Filter by status")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: json)",
  )
  .action(async (options) => {
    await listDevboxes(options);
  });

devbox
  .command("delete <id>")
  .description("Shutdown a devbox")
  .alias("rm")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(deleteDevbox);

devbox
  .command("exec <id> <command...>")
  .description("Execute a command in a devbox")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, command, options) => {
    await execCommand(id, command, options);
  });

devbox
  .command("upload <id> <file>")
  .description("Upload a file to a devbox")
  .option("-p, --path <path>", "Target path in devbox")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(uploadFile);

// Additional devbox commands
devbox
  .command("get <id>")
  .description("Get devbox details")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: json)",
  )
  .action(async (id, options) => {
    const { getDevbox } = await import("./commands/devbox/get.js");
    await getDevbox(id, options);
  });

devbox
  .command("suspend <id>")
  .description("Suspend a devbox")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { suspendDevbox } = await import("./commands/devbox/suspend.js");
    await suspendDevbox(id, options);
  });

devbox
  .command("resume <id>")
  .description("Resume a suspended devbox")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { resumeDevbox } = await import("./commands/devbox/resume.js");
    await resumeDevbox(id, options);
  });

devbox
  .command("shutdown <id>")
  .description("Shutdown a devbox")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { shutdownDevbox } = await import("./commands/devbox/shutdown.js");
    await shutdownDevbox(id, options);
  });

devbox
  .command("ssh <id>")
  .description("SSH into a devbox")
  .option("--config-only", "Print SSH config only")
  .option("--no-wait", "Do not wait for devbox to be ready")
  .option(
    "--timeout <seconds>",
    "Timeout in seconds to wait for readiness",
    "180",
  )
  .option(
    "--poll-interval <seconds>",
    "Polling interval in seconds while waiting",
    "3",
  )
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { sshDevbox } = await import("./commands/devbox/ssh.js");
    await sshDevbox(id, options);
  });

devbox
  .command("scp <id> <src> <dst>")
  .description("Copy files to/from a devbox using scp")
  .option("--scp-options <options>", "Additional scp options (quoted)")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, src, dst, options) => {
    const { scpFiles } = await import("./commands/devbox/scp.js");
    await scpFiles(id, { src, dst, ...options });
  });

devbox
  .command("rsync <id> <src> <dst>")
  .description("Sync files to/from a devbox using rsync")
  .option("--rsync-options <options>", "Additional rsync options (quoted)")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, src, dst, options) => {
    const { rsyncFiles } = await import("./commands/devbox/rsync.js");
    await rsyncFiles(id, { src, dst, ...options });
  });

devbox
  .command("tunnel <id> <ports>")
  .description("Create a port-forwarding tunnel to a devbox")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, ports, options) => {
    const { createTunnel } = await import("./commands/devbox/tunnel.js");
    await createTunnel(id, { ports, ...options });
  });

devbox
  .command("read <id>")
  .description("Read a file from a devbox using the API")
  .option("--remote <path>", "Remote file path to read from the devbox")
  .option("--output-path <path>", "Local file path to write the contents to")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { readFile } = await import("./commands/devbox/read.js");
    await readFile(id, options);
  });

devbox
  .command("write <id>")
  .description("Write a file to a devbox using the API")
  .option("--input <path>", "Local file path to read contents from")
  .option("--remote <path>", "Remote file path to write to on the devbox")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { writeFile } = await import("./commands/devbox/write.js");
    await writeFile(id, options);
  });

devbox
  .command("download <id>")
  .description("Download a file from a devbox")
  .option("--file-path <path>", "Path to the file in the devbox")
  .option(
    "--output-path <path>",
    "Local path where to save the downloaded file",
  )
  .option(
    "-o, --output-format [format]",
    "Output format: text|json|yaml (default: interactive)",
  )
  .action(async (id, options) => {
    const { downloadFile } = await import("./commands/devbox/download.js");
    await downloadFile(id, options);
  });

devbox
  .command("exec-async <id> <command...>")
  .description("Execute a command asynchronously on a devbox")
  .option("--shell-name <name>", "Shell name to use (optional)")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, command, options) => {
    const { execAsync } = await import("./commands/devbox/execAsync.js");
    await execAsync(id, { command: command.join(" "), ...options });
  });

devbox
  .command("get-async <id> <execution-id>")
  .description("Get status of an async execution")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, executionId, options) => {
    const { getAsync } = await import("./commands/devbox/getAsync.js");
    await getAsync(id, { executionId, ...options });
  });

devbox
  .command("logs <id>")
  .description("View devbox logs")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { getLogs } = await import("./commands/devbox/logs.js");
    await getLogs(id, options);
  });

// Snapshot commands
const snapshot = program
  .command("snapshot")
  .description("Manage devbox snapshots")
  .alias("snap")
  .action(async () => {
    // Open interactive snapshot list when no subcommand provided
    const { runInteractiveCommand } = await import(
      "./utils/interactiveCommand.js"
    );
    const { listSnapshots } = await import("./commands/snapshot/list.js");
    await runInteractiveCommand(() => listSnapshots({ output: "interactive" }));
  });

snapshot
  .command("list")
  .description("List all snapshots")
  .option("-d, --devbox <id>", "Filter by devbox ID")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: json)",
  )
  .action(async (options) => {
    const { listSnapshots } = await import("./commands/snapshot/list.js");
    await listSnapshots(options);
  });

snapshot
  .command("create <devbox-id>")
  .description("Create a snapshot of a devbox")
  .option("-n, --name <name>", "Snapshot name")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (devboxId, options) => {
    const { createSnapshot } = await import("./commands/snapshot/create.js");
    createSnapshot(devboxId, options);
  });

snapshot
  .command("delete <id>")
  .description("Delete a snapshot")
  .alias("rm")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { deleteSnapshot } = await import("./commands/snapshot/delete.js");
    deleteSnapshot(id, options);
  });

snapshot
  .command("status <snapshot-id>")
  .description("Get snapshot operation status")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (snapshotId, options) => {
    const { getSnapshotStatus } = await import("./commands/snapshot/status.js");
    await getSnapshotStatus({ snapshotId, ...options });
  });

// Blueprint commands
const blueprint = program
  .command("blueprint")
  .description("Manage blueprints")
  .alias("bp")
  .action(async () => {
    // Open interactive blueprint list when no subcommand provided
    const { runInteractiveCommand } = await import(
      "./utils/interactiveCommand.js"
    );
    const { listBlueprints } = await import("./commands/blueprint/list.js");
    await runInteractiveCommand(() =>
      listBlueprints({ output: "interactive" }),
    );
  });

blueprint
  .command("list")
  .description("List all blueprints")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: json)",
  )
  .action(async (options) => {
    const { listBlueprints } = await import("./commands/blueprint/list.js");
    await listBlueprints(options);
  });

blueprint
  .command("create <name>")
  .description("Create a new blueprint")
  .option("--dockerfile <content>", "Dockerfile contents")
  .option("--dockerfile-path <path>", "Dockerfile path")
  .option("--system-setup-commands <commands...>", "System setup commands")
  .option(
    "--resources <size>",
    "Resource size (X_SMALL, SMALL, MEDIUM, LARGE, X_LARGE, XX_LARGE)",
  )
  .option("--architecture <arch>", "Architecture (arm64, x86_64)")
  .option("--available-ports <ports...>", "Available ports")
  .option("--root", "Run as root")
  .option("--user <user:uid>", "Run as this user (format: username:uid)")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (name, options) => {
    const { createBlueprint } = await import("./commands/blueprint/create.js");
    await createBlueprint({ name, ...options });
  });

blueprint
  .command("preview <name>")
  .description("Preview blueprint before creation")
  .option("--dockerfile <content>", "Dockerfile contents")
  .option("--system-setup-commands <commands...>", "System setup commands")
  .option(
    "--resources <size>",
    "Resource size (X_SMALL, SMALL, MEDIUM, LARGE, X_LARGE, XX_LARGE)",
  )
  .option("--architecture <arch>", "Architecture (arm64, x86_64)")
  .option("--available-ports <ports...>", "Available ports")
  .option("--root", "Run as root")
  .option("--user <user:uid>", "Run as this user (format: username:uid)")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (name, options) => {
    const { previewBlueprint } = await import(
      "./commands/blueprint/preview.js"
    );
    await previewBlueprint({ name, ...options });
  });

blueprint
  .command("get <id>")
  .description("Get blueprint details")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { getBlueprint } = await import("./commands/blueprint/get.js");
    await getBlueprint({ id, ...options });
  });

blueprint
  .command("logs <id>")
  .description("Get blueprint build logs")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { getBlueprintLogs } = await import("./commands/blueprint/logs.js");
    await getBlueprintLogs({ id, ...options });
  });

// Object storage commands
const object = program
  .command("object")
  .description("Manage object storage")
  .alias("obj");

object
  .command("list")
  .description("List objects")
  .option("--limit <n>", "Max results", "20")
  .option("--starting-after <id>", "Starting point for pagination")
  .option("--name <name>", "Filter by name (partial match supported)")
  .option("--content-type <type>", "Filter by content type")
  .option("--state <state>", "Filter by state (UPLOADING, READ_ONLY, DELETED)")
  .option("--search <query>", "Search by object ID or name")
  .option("--public", "List public objects only")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: json)",
  )
  .action(async (options) => {
    const { listObjects } = await import("./commands/object/list.js");
    await listObjects(options);
  });

object
  .command("get <id>")
  .description("Get object details")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { getObject } = await import("./commands/object/get.js");
    await getObject({ id, ...options });
  });

object
  .command("download <id> <path>")
  .description("Download object to local file")
  .option("--extract", "Extract downloaded archive after download")
  .option(
    "--duration-seconds <seconds>",
    "Duration in seconds for the presigned URL validity",
    "3600",
  )
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, path, options) => {
    const { downloadObject } = await import("./commands/object/download.js");
    await downloadObject({ id, path, ...options });
  });

object
  .command("upload <path>")
  .description("Upload a file as an object")
  .option("--name <name>", "Object name (required)")
  .option(
    "--content-type <type>",
    "Content type: unspecified|text|binary|gzip|tar|tgz",
  )
  .option("--public", "Make object publicly accessible")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (path, options) => {
    const { uploadObject } = await import("./commands/object/upload.js");
    if (!options.output) {
      const { runInteractiveCommand } = await import(
        "./utils/interactiveCommand.js"
      );
      await runInteractiveCommand(() => uploadObject({ path, ...options }));
    } else {
      await uploadObject({ path, ...options });
    }
  });

object
  .command("delete <id>")
  .description("Delete an object (irreversible)")
  .option(
    "-o, --output [format]",
    "Output format: text|json|yaml (default: text)",
  )
  .action(async (id, options) => {
    const { deleteObject } = await import("./commands/object/delete.js");
    await deleteObject({ id, ...options });
  });

// MCP server commands
const mcp = program
  .command("mcp")
  .description("Model Context Protocol (MCP) server commands");

mcp
  .command("start")
  .description("Start the MCP server")
  .option("--http", "Use HTTP/SSE transport instead of stdio")
  .option(
    "-p, --port <port>",
    "Port to listen on for HTTP mode (default: 3000)",
    parseInt,
  )
  .action(async (options) => {
    if (options.http) {
      const { startMcpHttpServer } = await import("./commands/mcp-http.js");
      await startMcpHttpServer(options.port);
    } else {
      const { startMcpServer } = await import("./commands/mcp.js");
      await startMcpServer();
    }
  });

mcp
  .command("install")
  .description("Install Runloop MCP server configuration in Claude Desktop")
  .action(async () => {
    const { installMcpConfig } = await import("./commands/mcp-install.js");
    await installMcpConfig();
  });

// Hidden command: 'rli mcp' without subcommand starts the server (for Claude Desktop config compatibility)
program
  .command("mcp-server", { hidden: true })
  .option("--http", "Use HTTP/SSE transport instead of stdio")
  .option(
    "-p, --port <port>",
    "Port to listen on for HTTP mode (default: 3000)",
    parseInt,
  )
  .action(async (options) => {
    if (options.http) {
      const { startMcpHttpServer } = await import("./commands/mcp-http.js");
      await startMcpHttpServer(options.port);
    } else {
      const { startMcpServer } = await import("./commands/mcp.js");
      await startMcpServer();
    }
  });

// Main CLI entry point
(async () => {
  // Check if API key is configured (except for auth and mcp commands)
  const args = process.argv.slice(2);
  if (
    args[0] !== "auth" &&
    args[0] !== "mcp" &&
    args[0] !== "mcp-server" &&
    args[0] !== "--help" &&
    args[0] !== "-h" &&
    args.length > 0
  ) {
    const config = getConfig();
    if (!config.apiKey) {
      console.error("\n❌ API key not configured. Run: rli auth\n");
      process.exit(1);
    }
  }

  // If no command provided, show main menu (version check handled in UI)
  if (args.length === 0) {
    const { runMainMenu } = await import("./commands/menu.js");
    runMainMenu();
  } else {
    // Check for updates for non-interactive commands (stderr output)
    const { checkForUpdates } = await import("./utils/config.js");
    await checkForUpdates();
    program.parse();
  }
})();

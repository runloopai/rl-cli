import { Command } from "commander";
import { VERSION } from "../version.js";
import { createDevbox } from "../commands/devbox/create.js";
import { listDevboxes } from "../commands/devbox/list.js";
import { deleteDevbox } from "../commands/devbox/delete.js";
import { execCommand } from "../commands/devbox/exec.js";
import { uploadFile } from "../commands/devbox/upload.js";

/**
 * Creates and configures the Commander program with all commands.
 * This is shared between the CLI and documentation generation.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name("rli")
    .description("Beautiful CLI for Runloop devbox management")
    .version(VERSION);

  // Devbox commands
  const devbox = program
    .command("devbox")
    .description("Manage devboxes")
    .alias("d");

  devbox
    .command("create")
    .description("Create a new devbox")
    .option("-n, --name <name>", "Devbox name")
    .option(
      "-t, --template <template>",
      "Snapshot ID to use (alias: --snapshot)",
    )
    .option("-s, --snapshot <snapshot>", "Snapshot ID to use")
    .option("--blueprint <blueprint>", "Blueprint name or ID to use")
    .option(
      "--resources <size>",
      "Resource size (X_SMALL, SMALL, MEDIUM, LARGE, X_LARGE, XX_LARGE)",
    )
    .option("--architecture <arch>", "Architecture (arm64, x86_64)")
    .option("--entrypoint <command>", "Entrypoint command to run")
    .option(
      "--launch-commands <commands...>",
      "Initialization commands to run on startup",
    )
    .option("--env-vars <vars...>", "Environment variables (format: KEY=value)")
    .option(
      "--code-mounts <mounts...>",
      "Code mount configurations (JSON format)",
    )
    .option("--idle-time <seconds>", "Idle time in seconds before idle action")
    .option("--idle-action <action>", "Action on idle (shutdown, suspend)")
    .option("--available-ports <ports...>", "Available ports")
    .option("--root", "Run as root")
    .option("--user <user:uid>", "Run as this user (format: username:uid)")
    .option("--network-policy <id>", "Network policy ID to apply")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(createDevbox);

  devbox
    .command("list")
    .description("List all devboxes")
    .option(
      "-s, --status <status>",
      "Filter by status (initializing, running, suspending, suspended, resuming, failure, shutdown)",
    )
    .option("-l, --limit <n>", "Max results", "20")
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
    .option("--shell-name <name>", "Shell name to use (optional)")
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
      const { getDevbox } = await import("../commands/devbox/get.js");
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
      const { suspendDevbox } = await import("../commands/devbox/suspend.js");
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
      const { resumeDevbox } = await import("../commands/devbox/resume.js");
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
      const { shutdownDevbox } = await import("../commands/devbox/shutdown.js");
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
      const { sshDevbox } = await import("../commands/devbox/ssh.js");
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
      const { scpFiles } = await import("../commands/devbox/scp.js");
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
      const { rsyncFiles } = await import("../commands/devbox/rsync.js");
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
      const { createTunnel } = await import("../commands/devbox/tunnel.js");
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
      const { readFile } = await import("../commands/devbox/read.js");
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
      const { writeFile } = await import("../commands/devbox/write.js");
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
      const { downloadFile } = await import("../commands/devbox/download.js");
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
      const { execAsync } = await import("../commands/devbox/execAsync.js");
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
      const { getAsync } = await import("../commands/devbox/getAsync.js");
      await getAsync(id, { executionId, ...options });
    });

  devbox
    .command("send-stdin <id> <execution-id>")
    .description("Send stdin to a running async execution")
    .option("--text <text>", "Text content to send to stdin")
    .option("--signal <signal>", "Signal to send (EOF, INTERRUPT)")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, executionId, options) => {
      const { sendStdin } = await import("../commands/devbox/sendStdin.js");
      await sendStdin(id, executionId, options);
    });

  devbox
    .command("logs <id>")
    .description("View devbox logs")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, options) => {
      const { getLogs } = await import("../commands/devbox/logs.js");
      await getLogs(id, options);
    });

  // Snapshot commands
  const snapshot = program
    .command("snapshot")
    .description("Manage devbox snapshots")
    .alias("snap");

  snapshot
    .command("list")
    .description("List all snapshots")
    .option("-d, --devbox <id>", "Filter by devbox ID")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { listSnapshots } = await import("../commands/snapshot/list.js");
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
      const { createSnapshot } = await import("../commands/snapshot/create.js");
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
      const { deleteSnapshot } = await import("../commands/snapshot/delete.js");
      deleteSnapshot(id, options);
    });

  snapshot
    .command("get <id>")
    .description("Get snapshot details")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (id, options) => {
      const { getSnapshot } = await import("../commands/snapshot/get.js");
      await getSnapshot({ id, ...options });
    });

  snapshot
    .command("status <snapshot-id>")
    .description("Get snapshot operation status")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (snapshotId, options) => {
      const { getSnapshotStatus } = await import(
        "../commands/snapshot/status.js"
      );
      await getSnapshotStatus({ snapshotId, ...options });
    });

  // Blueprint commands
  const blueprint = program
    .command("blueprint")
    .description("Manage blueprints")
    .alias("bp");

  blueprint
    .command("list")
    .description("List all blueprints")
    .option("-n, --name <name>", "Filter by blueprint name")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { listBlueprints } = await import("../commands/blueprint/list.js");
      await listBlueprints(options);
    });

  blueprint
    .command("create")
    .description("Create a new blueprint")
    .requiredOption("--name <name>", "Blueprint name (required)")
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
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { createBlueprint } = await import(
        "../commands/blueprint/create.js"
      );
      await createBlueprint(options);
    });

  blueprint
    .command("get <name-or-id>")
    .description("Get blueprint details by name or ID (IDs start with bpt_)")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (id, options) => {
      const { getBlueprint } = await import("../commands/blueprint/get.js");
      await getBlueprint({ id, ...options });
    });

  blueprint
    .command("logs <name-or-id>")
    .description("Get blueprint build logs by name or ID (IDs start with bpt_)")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, options) => {
      const { getBlueprintLogs } = await import(
        "../commands/blueprint/logs.js"
      );
      await getBlueprintLogs({ id, ...options });
    });

  blueprint
    .command("prune <name>")
    .description(
      "Delete old blueprint builds, keeping only recent successful ones",
    )
    .option("--dry-run", "Show what would be deleted without actually deleting")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--keep <n>", "Number of successful builds to keep", "1")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (name, options) => {
      const { pruneBlueprints } = await import(
        "../commands/blueprint/prune.js"
      );
      await pruneBlueprints(name, options);
    });

  blueprint
    .command("from-dockerfile")
    .description(
      "Create a blueprint from a Dockerfile with build context support",
    )
    .requiredOption("--name <name>", "Blueprint name (required)")
    .option(
      "--build-context <path>",
      "Build context directory (default: current directory)",
    )
    .option(
      "--dockerfile <path>",
      "Dockerfile path (default: Dockerfile in build context)",
    )
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
      "--ttl <seconds>",
      "TTL in seconds for the build context object (default: 3600)",
    )
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { createBlueprintFromDockerfile } = await import(
        "../commands/blueprint/from-dockerfile.js"
      );
      await createBlueprintFromDockerfile(options);
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
    .option(
      "--state <state>",
      "Filter by state (UPLOADING, READ_ONLY, DELETED)",
    )
    .option("--search <query>", "Search by object ID or name")
    .option("--public", "List public objects only")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { listObjects } = await import("../commands/object/list.js");
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
      const { getObject } = await import("../commands/object/get.js");
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
      const { downloadObject } = await import("../commands/object/download.js");
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
      const { uploadObject } = await import("../commands/object/upload.js");
      if (!options.output) {
        const { runInteractiveCommand } = await import(
          "../utils/interactiveCommand.js"
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
      const { deleteObject } = await import("../commands/object/delete.js");
      await deleteObject({ id, ...options });
    });

  // Network policy commands
  const networkPolicy = program
    .command("network-policy")
    .description("Manage network policies")
    .alias("np");

  networkPolicy
    .command("list")
    .description("List network policies")
    .option("--limit <n>", "Max results", "20")
    .option("--starting-after <id>", "Starting point for pagination")
    .option("--name <name>", "Filter by name")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { listNetworkPolicies } = await import(
        "../commands/network-policy/list.js"
      );
      await listNetworkPolicies(options);
    });

  networkPolicy
    .command("get <id>")
    .description("Get network policy details")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (id, options) => {
      const { getNetworkPolicy } = await import(
        "../commands/network-policy/get.js"
      );
      await getNetworkPolicy({ id, ...options });
    });

  networkPolicy
    .command("create")
    .description("Create a new network policy")
    .requiredOption("--name <name>", "Policy name (required)")
    .option("--description <description>", "Policy description")
    .option("--allow-all", "Allow all egress traffic")
    .option("--allow-devbox-to-devbox", "Allow devbox-to-devbox communication")
    .option(
      "--allowed-hostnames <hostnames...>",
      "List of allowed hostnames for egress",
    )
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (options) => {
      const { createNetworkPolicy } = await import(
        "../commands/network-policy/create.js"
      );
      await createNetworkPolicy(options);
    });

  networkPolicy
    .command("delete <id>")
    .description("Delete a network policy")
    .alias("rm")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, options) => {
      const { deleteNetworkPolicy } = await import(
        "../commands/network-policy/delete.js"
      );
      await deleteNetworkPolicy(id, options);
    });

  // Secret commands
  const secret = program
    .command("secret")
    .description("Manage secrets")
    .alias("s");

  secret
    .command("create <name>")
    .description("Create a new secret (value from stdin or secure prompt)")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (name, options) => {
      const { createSecret } = await import("../commands/secret/create.js");
      await createSecret(name, options);
    });

  secret
    .command("list")
    .description("List all secrets")
    .option("--limit <n>", "Max results", "20")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { listSecrets } = await import("../commands/secret/list.js");
      await listSecrets(options);
    });

  secret
    .command("get <name>")
    .description("Get secret metadata by name")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (name, options) => {
      const { getSecret } = await import("../commands/secret/get.js");
      await getSecret(name, options);
    });

  secret
    .command("update <name>")
    .description("Update a secret value (value from stdin or secure prompt)")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (name, options) => {
      const { updateSecret } = await import("../commands/secret/update.js");
      await updateSecret(name, options);
    });

  secret
    .command("delete <name>")
    .description("Delete a secret")
    .option("-y, --yes", "Skip confirmation prompt")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (name, options) => {
      const { deleteSecret } = await import("../commands/secret/delete.js");
      await deleteSecret(name, options);
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
        const { startMcpHttpServer } = await import("../commands/mcp-http.js");
        await startMcpHttpServer(options.port);
      } else {
        const { startMcpServer } = await import("../commands/mcp.js");
        await startMcpServer();
      }
    });

  mcp
    .command("install")
    .description("Install Runloop MCP server configuration in Claude Desktop")
    .action(async () => {
      const { installMcpConfig } = await import("../commands/mcp-install.js");
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
        const { startMcpHttpServer } = await import("../commands/mcp-http.js");
        await startMcpHttpServer(options.port);
      } else {
        const { startMcpServer } = await import("../commands/mcp.js");
        await startMcpServer();
      }
    });

  return program;
}

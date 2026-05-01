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
    .showHelpAfterError()
    .showSuggestionAfterError();

  // Custom --version handling: warn when other args are present
  program.option("-V, --version", "output the version number");
  program.on("option:version", () => {
    const otherArgs = process.argv
      .slice(2)
      .filter((a) => a !== "--version" && a !== "-V");
    if (otherArgs.length > 0) {
      console.log(`RLI version: ${VERSION}   (other args ignored)`);
    } else {
      console.log(VERSION);
    }
    process.exit(0);
  });

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
      "--secrets <secrets...>",
      "Secrets to inject as environment variables (format: ENV_VAR=SECRET_NAME)",
    )
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
      "--tunnel <mode>",
      "Tunnel authentication mode (open, authenticated)",
    )
    .option(
      "--gateways <gateways...>",
      "Gateway configurations (format: ENV_PREFIX=gateway_id_or_name,secret_id_or_name)",
    )
    .option(
      "--mcp <specs...>",
      "MCP configurations (format: ENV_VAR_NAME=mcp_config_id_or_name,secret_id_or_name)",
    )
    .option(
      "--agent <agent...>",
      "Agents to mount (format: name_or_id or name_or_id:/mount/path)",
    )
    .option(
      "--object <object...>",
      "Objects to mount (format: object_id or object_id:/mount/path)",
    )
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
    .command("scp <src> <dst>")
    .description(
      "Copy files to/from a devbox using scp (e.g. rli devbox scp dbx_id:/remote ./local)",
    )
    .option("--scp-options <options>", "Additional scp options (quoted)")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (src, dst, options) => {
      const { scpFiles } = await import("../commands/devbox/scp.js");
      await scpFiles(src, dst, options);
    });

  devbox
    .command("rsync <src> <dst>")
    .description(
      "Sync files to/from a devbox using rsync (e.g. rli devbox rsync dbx_id:/remote ./local)",
    )
    .option("--rsync-options <options>", "Additional rsync options (quoted)")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (src, dst, options) => {
      const { rsyncFiles } = await import("../commands/devbox/rsync.js");
      await rsyncFiles(src, dst, options);
    });

  devbox
    .command("tunnel <id> <ports>")
    .description("Create a port-forwarding tunnel to a devbox")
    .option("--open", "Open the tunnel URL in browser automatically")
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
    .option("-l, --limit <n>", "Max results", "20")
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
    .command("prune <devbox-id>")
    .description(
      "Delete old snapshots for a devbox, keeping only recent ready ones",
    )
    .option("--dry-run", "Show what would be deleted without actually deleting")
    .option("-y, --yes", "Skip confirmation prompt")
    .option("--keep <n>", "Number of ready snapshots to keep", "1")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (devboxId, options) => {
      const { pruneSnapshots } = await import("../commands/snapshot/prune.js");
      await pruneSnapshots(devboxId, options);
    });

  snapshot
    .command("status <snapshot-id>")
    .description("Get snapshot operation status")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (snapshotId, options) => {
      const { getSnapshotStatus } =
        await import("../commands/snapshot/status.js");
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
    .option("-l, --limit <n>", "Max results", "20")
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
    .option("--name <name>", "Blueprint name (required unless --base is used)")
    .option(
      "--base <name-or-id>",
      "Base blueprint to duplicate (IDs start with bpt_)",
    )
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
    .option("--metadata <tags...>", "Metadata tags (format: key=value)")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { createBlueprint } =
        await import("../commands/blueprint/create.js");
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
      const { getBlueprintLogs } =
        await import("../commands/blueprint/logs.js");
      await getBlueprintLogs({ id, ...options });
    });

  blueprint
    .command("delete <id>")
    .description("Delete a blueprint by ID")
    .alias("rm")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, options) => {
      const { deleteBlueprint } =
        await import("../commands/blueprint/delete.js");
      await deleteBlueprint(id, options);
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
      const { pruneBlueprints } =
        await import("../commands/blueprint/prune.js");
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
    .option("--metadata <tags...>", "Metadata tags (format: key=value)")
    .option(
      "--ttl <seconds>",
      "TTL in seconds for the build context object (default: 3600)",
    )
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { createBlueprintFromDockerfile } =
        await import("../commands/blueprint/from-dockerfile.js");
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
    .command("upload <paths...>")
    .description(
      "Upload file(s) or directory as an object. Multiple paths with --content-type tar|tgz creates an archive.",
    )
    .option("--name <name>", "Object name (required)")
    .option(
      "--content-type <type>",
      "Content type: unspecified|text|binary|gzip|tar|tgz",
    )
    .option("--public", "Make object publicly accessible")
    .option("--metadata <tags...>", "Metadata tags (format: key=value)")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (paths, options) => {
      const { uploadObject } = await import("../commands/object/upload.js");
      if (!options.output) {
        const { runInteractiveCommand } =
          await import("../utils/interactiveCommand.js");
        await runInteractiveCommand(() => uploadObject({ paths, ...options }));
      } else {
        await uploadObject({ paths, ...options });
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
      const { listNetworkPolicies } =
        await import("../commands/network-policy/list.js");
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
      const { getNetworkPolicy } =
        await import("../commands/network-policy/get.js");
      await getNetworkPolicy({ id, ...options });
    });

  networkPolicy
    .command("create")
    .description("Create a new network policy")
    .requiredOption("--name <name>", "Policy name (required)")
    .option("--description <description>", "Policy description")
    .option("--allow-all", "Allow all egress traffic")
    .option("--allow-devbox-to-devbox", "Allow devbox-to-devbox communication")
    .option("--allow-agent-gateway", "Allow Agent gateway access")
    .option("--allow-mcp-gateway", "Allow MCP gateway access")
    .option(
      "--allowed-hostnames <hostnames...>",
      "List of allowed hostnames for egress",
    )
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (options) => {
      const { createNetworkPolicy } =
        await import("../commands/network-policy/create.js");
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
      const { deleteNetworkPolicy } =
        await import("../commands/network-policy/delete.js");
      await deleteNetworkPolicy(id, options);
    });

  // Secret commands
  const secret = program
    .command("secret")
    .description("Manage secrets")
    .alias("s");

  secret
    .command("create <name>")
    .description(
      "Create a new secret. Value can be piped via stdin (e.g., echo 'val' | rli secret create name) or entered interactively with masked input for security.",
    )
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

  // Gateway config commands
  const gatewayConfig = program
    .command("gateway-config")
    .description("Manage gateway configurations")
    .alias("gwc");

  gatewayConfig
    .command("list")
    .description("List gateway configurations")
    .option("--name <name>", "Filter by name")
    .option("--limit <n>", "Max results", "20")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { listGatewayConfigs } =
        await import("../commands/gateway-config/list.js");
      await listGatewayConfigs(options);
    });

  gatewayConfig
    .command("create")
    .description("Create a new gateway configuration")
    .requiredOption("--name <name>", "Gateway config name (required)")
    .requiredOption("--endpoint <url>", "Target endpoint URL (required)")
    .option("--bearer-auth", "Use Bearer token authentication (default)")
    .option(
      "--header-auth <header>",
      "Use custom header authentication (specify header key name)",
    )
    .option("--description <description>", "Description")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (options) => {
      const { createGatewayConfig } =
        await import("../commands/gateway-config/create.js");
      await createGatewayConfig(options);
    });

  gatewayConfig
    .command("get <id>")
    .description("Get gateway configuration details")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (id, options) => {
      const { getGatewayConfig } =
        await import("../commands/gateway-config/get.js");
      await getGatewayConfig({ id, ...options });
    });

  gatewayConfig
    .command("update <id>")
    .description("Update a gateway configuration")
    .option("--name <name>", "New name")
    .option("--endpoint <url>", "New endpoint URL")
    .option("--bearer-auth", "Use Bearer token authentication")
    .option(
      "--header-auth <header>",
      "Use custom header authentication (specify header key name)",
    )
    .option("--description <description>", "New description")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, options) => {
      const { updateGatewayConfig } =
        await import("../commands/gateway-config/update.js");
      await updateGatewayConfig({ id, ...options });
    });

  gatewayConfig
    .command("delete <id>")
    .description("Delete a gateway configuration")
    .alias("rm")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, options) => {
      const { deleteGatewayConfig } =
        await import("../commands/gateway-config/delete.js");
      await deleteGatewayConfig(id, options);
    });

  // MCP config commands
  const mcpConfig = program
    .command("mcp-config")
    .description("Manage MCP configurations")
    .alias("mcpc");

  mcpConfig
    .command("list")
    .description("List MCP configurations")
    .option("--name <name>", "Filter by name")
    .option("--limit <n>", "Max results", "20")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { listMcpConfigs } = await import("../commands/mcp-config/list.js");
      await listMcpConfigs(options);
    });

  mcpConfig
    .command("create")
    .description("Create a new MCP configuration")
    .requiredOption("--name <name>", "MCP config name (required)")
    .requiredOption("--endpoint <url>", "Target endpoint URL (required)")
    .requiredOption(
      "--allowed-tools <tools>",
      "Allowed tool patterns, comma-separated (required, e.g. '*' or 'github.search_*,github.get_*')",
    )
    .option("--description <description>", "Description")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (options) => {
      const { createMcpConfig } =
        await import("../commands/mcp-config/create.js");
      await createMcpConfig(options);
    });

  mcpConfig
    .command("get <id>")
    .description("Get MCP configuration details")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (id, options) => {
      const { getMcpConfig } = await import("../commands/mcp-config/get.js");
      await getMcpConfig({ id, ...options });
    });

  mcpConfig
    .command("update <id>")
    .description("Update an MCP configuration")
    .option("--name <name>", "New name")
    .option("--endpoint <url>", "New endpoint URL")
    .option(
      "--allowed-tools <tools>",
      "New allowed tool patterns, comma-separated",
    )
    .option("--description <description>", "New description")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, options) => {
      const { updateMcpConfig } =
        await import("../commands/mcp-config/update.js");
      await updateMcpConfig({ id, ...options });
    });

  mcpConfig
    .command("delete <id>")
    .description("Delete an MCP configuration")
    .alias("rm")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, options) => {
      const { deleteMcpConfig } =
        await import("../commands/mcp-config/delete.js");
      await deleteMcpConfig(id, options);
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

  // Axon commands (beta)
  const axon = program.command("axon").description("Manage axons (beta)");

  axon
    .command("list")
    .description("List active axons")
    .option("--limit <n>", "Max axons to return (0 = unlimited)", "0")
    .option(
      "--starting-after <id>",
      "Starting point for cursor pagination (axon ID)",
    )
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (options) => {
      const { listAxonsCommand } = await import("../commands/axon/list.js");
      await listAxonsCommand(options);
    });

  axon
    .command("events <id>")
    .description("List events for an axon")
    .option("--limit <n>", "Number of events to fetch", "50")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, options) => {
      const { listAxonEventsCommand } =
        await import("../commands/axon/events.js");
      await listAxonEventsCommand(id, options);
    });

  // Scenario commands
  const scenario = program
    .command("scenario")
    .description("Manage scenarios")
    .alias("scn");

  scenario
    .command("info <id>")
    .description("Display scenario definition details")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, options) => {
      const { scenarioInfo } = await import("../commands/scenario/info.js");
      await scenarioInfo(id, options);
    });

  scenario
    .command("list")
    .description("List scenario runs")
    .option("--limit <n>", "Max scenario runs to return (0 = unlimited)", "0")
    .option("--benchmark-run-id <id>", "Filter by benchmark run ID")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (options) => {
      const { listScenarioRunsCommand } =
        await import("../commands/scenario/list.js");
      await listScenarioRunsCommand(options);
    });

  // Benchmark job commands
  const benchmarkJob = program
    .command("benchmark-job")
    .description("Manage benchmark jobs")
    .alias("bmj");

  benchmarkJob
    .command("run")
    .description("Run a benchmark job with one or more agents")
    .option(
      "--agent <agents...>",
      "Agent(s) to use. Format: agent:model (e.g., claude-code:claude-sonnet-4). Can specify multiple.",
    )
    .option("--benchmark <id-or-name>", "Benchmark ID or name to run")
    .option(
      "--scenarios <ids...>",
      "Scenario IDs to run (alternative to --benchmark)",
    )
    .option("-n, --job-name <name>", "Job name")
    .option(
      "--env-vars <vars...>",
      "Additional environment variables (format: KEY=value)",
    )
    .option(
      "--secrets <secrets...>",
      "Secrets to inject as environment variables (format: ENV_VAR=SECRET_NAME)",
    )
    .option("--timeout <seconds>", "Agent timeout in seconds")
    .option("--n-attempts <n>", "Number of attempts per scenario")
    .option("--n-concurrent-trials <n>", "Number of concurrent trials")
    .option("--timeout-multiplier <n>", "Timeout multiplier")
    .option("--metadata <tags...>", "Metadata tags (format: key=value)")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (options) => {
      const { runBenchmarkJob } =
        await import("../commands/benchmark-job/run.js");
      await runBenchmarkJob(options);
    });

  benchmarkJob
    .command("summary <id>")
    .description("Get benchmark job summary and results")
    .option("-e, --extended", "Show individual scenario results")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (id, options) => {
      const { summaryBenchmarkJob } =
        await import("../commands/benchmark-job/summary.js");
      await summaryBenchmarkJob(id, options);
    });

  benchmarkJob
    .command("watch <id>")
    .description("Watch benchmark job progress in real-time (full-screen)")
    .action(async (id) => {
      const { watchBenchmarkJob } =
        await import("../commands/benchmark-job/watch.js");
      await watchBenchmarkJob(id);
    });

  benchmarkJob
    .command("logs <id>")
    .description(
      "Download devbox logs for all scenario runs in a benchmark job",
    )
    .option("-o, --output-dir <path>", "Output directory")
    .option("--run <id>", "Download logs for a specific benchmark run only")
    .option("--scenario <id>", "Download logs for a specific scenario run only")
    .action(async (id, options) => {
      const { downloadBenchmarkJobLogs } =
        await import("../commands/benchmark-job/logs.js");
      await downloadBenchmarkJobLogs(id, options);
    });

  benchmarkJob
    .command("list")
    .description("List benchmark jobs")
    .option("--days <n>", "Show jobs from the last N days (default: 1)")
    .option("--all", "Show all jobs (no time filter)")
    .option(
      "--status <statuses>",
      "Filter by status (comma-separated). Valid: initializing, queued, running, completed, failed, cancelled, timeout",
    )
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (options) => {
      const { listBenchmarkJobsCommand } =
        await import("../commands/benchmark-job/list.js");
      await listBenchmarkJobsCommand(options);
    });

  // Agent commands
  const agent = program
    .command("agent")
    .description("Manage agents")
    .alias("agt");

  agent
    .command("list")
    .description("List agents")
    .option("--full", "Show all versions for all agents")
    .option("--name <name>", "Filter by name (partial match)")
    .option("--search <query>", "Search by agent ID or name")
    .option("--public", "Show only public agents")
    .option("--private", "Show only private agents")
    .option("--limit <n>", "Max results to return (0 = unlimited)", "0")
    .option("--starting-after <id>", "Cursor for pagination (agent ID)")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: json)",
    )
    .action(async (options) => {
      const { listAgentsCommand } = await import("../commands/agent/list.js");
      await listAgentsCommand(options);
    });

  agent
    .command("create")
    .description("Create a new agent")
    .requiredOption("--name <name>", "Agent name")
    .option("--agent-version <version>", "Version string (optional)")
    .requiredOption("--source <type>", "Source type: npm|pip|git|object")
    .option("--package <name>", "Package name (for npm/pip sources)")
    .option("--registry-url <url>", "Registry URL (for npm/pip sources)")
    .option("--repository <url>", "Git repository URL (for git source)")
    .option("--ref <ref>", "Git ref - branch or tag (for git source)")
    .option("--object-id <id>", "Object ID (for object source)")
    .option(
      "--setup-commands <commands...>",
      "Setup commands to run after installation",
    )
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (options) => {
      const { createAgentCommand } =
        await import("../commands/agent/create.js");
      await createAgentCommand(options);
    });

  agent
    .command("delete <id-or-name>")
    .description("Delete an agent")
    .alias("rm")
    .option("-y, --yes", "Skip confirmation prompt")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (idOrName, options) => {
      const { deleteAgentCommand } =
        await import("../commands/agent/delete.js");
      await deleteAgentCommand(idOrName, options);
    });

  agent
    .command("show <id-or-name>")
    .description("Show agent details")
    .option(
      "-o, --output [format]",
      "Output format: text|json|yaml (default: text)",
    )
    .action(async (idOrName, options) => {
      const { showAgentCommand } = await import("../commands/agent/show.js");
      await showAgentCommand(idOrName, options);
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

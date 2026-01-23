/**
 * Create blueprint from Dockerfile command
 *
 * Manually handles each step with progress feedback:
 * 1. Upload build context as tarball
 * 2. Create blueprint
 * 3. Poll for build completion
 */

import { readFile, stat } from "fs/promises";
import { resolve, join } from "path";
import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";
import { StorageObject } from "@runloop/api-client/sdk";
import type { BlueprintCreateParams } from "@runloop/api-client/resources/blueprints";

interface FromDockerfileOptions {
  name: string;
  buildContext?: string;
  dockerfile?: string;
  systemSetupCommands?: string[];
  resources?: string;
  architecture?: string;
  availablePorts?: string[];
  root?: boolean;
  user?: string;
  ttl?: string;
  noWait?: boolean;
  output?: string;
}

// Helper to check if we should show progress
function shouldShowProgress(options: FromDockerfileOptions): boolean {
  return !options.output || options.output === "text";
}

// Helper to log progress (to stderr so it doesn't interfere with JSON output)
function logProgress(message: string, options: FromDockerfileOptions): void {
  if (shouldShowProgress(options)) {
    console.error(message);
  }
}

// Helper to format elapsed time
function formatElapsed(startTime: number): string {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  if (elapsed < 60) {
    return `${elapsed}s`;
  }
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${minutes}m ${seconds}s`;
}

export async function createBlueprintFromDockerfile(
  options: FromDockerfileOptions,
) {
  const startTime = Date.now();

  try {
    const client = getClient();

    // Resolve build context path (defaults to current directory)
    const buildContextPath = resolve(options.buildContext || ".");

    // Verify build context exists and is a directory
    try {
      const stats = await stat(buildContextPath);
      if (!stats.isDirectory()) {
        outputError(
          `Build context path is not a directory: ${buildContextPath}`,
        );
      }
    } catch {
      outputError(`Build context path does not exist: ${buildContextPath}`);
    }

    // Resolve Dockerfile path
    const dockerfilePath = options.dockerfile
      ? resolve(options.dockerfile)
      : join(buildContextPath, "Dockerfile");

    // Verify Dockerfile exists
    try {
      const stats = await stat(dockerfilePath);
      if (!stats.isFile()) {
        outputError(`Dockerfile path is not a file: ${dockerfilePath}`);
      }
    } catch {
      outputError(`Dockerfile not found: ${dockerfilePath}`);
    }

    // Log initial info
    logProgress(
      `\n📦 Creating blueprint "${options.name}" from Dockerfile`,
      options,
    );
    logProgress(`   Build context: ${buildContextPath}`, options);
    logProgress(`   Dockerfile: ${dockerfilePath}\n`, options);

    // Read the Dockerfile contents
    const dockerfileContents = await readFile(dockerfilePath, "utf-8");

    // Parse user parameters
    let userParameters = undefined;
    if (options.user && options.root) {
      outputError("Only one of --user or --root can be specified");
    } else if (options.user) {
      const [username, uid] = options.user.split(":");
      if (!username || !uid) {
        outputError("User must be in format 'username:uid'");
      }
      userParameters = { username, uid: parseInt(uid) };
    } else if (options.root) {
      userParameters = { username: "root", uid: 0 };
    }

    // Build launch parameters
    const launchParameters: Record<string, unknown> = {};
    if (options.resources) {
      launchParameters.resource_size_request = options.resources;
    }
    if (options.architecture) {
      launchParameters.architecture = options.architecture;
    }
    if (options.availablePorts) {
      launchParameters.available_ports = options.availablePorts.map((port) =>
        parseInt(port, 10),
      );
    }
    if (userParameters) {
      launchParameters.user_parameters = userParameters;
    }

    // Parse TTL (default: 1 hour = 3600000ms)
    const ttlMs = options.ttl ? parseInt(options.ttl) * 1000 : 3600000;

    // Step 1: Upload build context
    logProgress(
      `⏳ [1/3] Creating and uploading build context tarball...`,
      options,
    );
    const uploadStart = Date.now();

    const storageObject = await StorageObject.uploadFromDir(
      client,
      buildContextPath,
      {
        name: `build-context-${options.name}`,
        ttl_ms: ttlMs,
      },
    );

    logProgress(
      `✅ [1/3] Build context uploaded (${formatElapsed(uploadStart)})`,
      options,
    );
    logProgress(`   Object ID: ${storageObject.id}`, options);

    // Step 2: Create the blueprint
    logProgress(`\n⏳ [2/3] Creating blueprint...`, options);
    const createStart = Date.now();

    const createParams: BlueprintCreateParams = {
      name: options.name,
      dockerfile: dockerfileContents,
      system_setup_commands: options.systemSetupCommands,
      launch_parameters:
        launchParameters as BlueprintCreateParams["launch_parameters"],
      build_context: {
        type: "object",
        object_id: storageObject.id,
      },
    };

    const blueprintResponse = await client.blueprints.create(createParams);

    logProgress(
      `✅ [2/3] Blueprint created (${formatElapsed(createStart)})`,
      options,
    );
    logProgress(`   Blueprint ID: ${blueprintResponse.id}`, options);

    // Step 3: Wait for build to complete (unless --no-wait)
    if (options.noWait) {
      logProgress(`\n⏩ Skipping build wait (--no-wait specified)`, options);
      logProgress(
        `   Check status with: rli blueprint get ${blueprintResponse.id}`,
        options,
      );
      logProgress(
        `   View logs with: rli blueprint logs ${blueprintResponse.id}\n`,
        options,
      );
      output(blueprintResponse, {
        format: options.output,
        defaultFormat: "json",
      });
      return;
    }

    logProgress(`\n⏳ [3/3] Waiting for build to complete...`, options);
    const buildStart = Date.now();
    let lastStatus = "";
    let pollCount = 0;

    // Poll for completion
    while (true) {
      const blueprint = await client.blueprints.retrieve(blueprintResponse.id);
      const currentStatus = blueprint.status || "unknown";

      // Log status changes
      if (currentStatus !== lastStatus) {
        const elapsed = formatElapsed(buildStart);
        logProgress(`   Status: ${currentStatus} (${elapsed})`, options);
        lastStatus = currentStatus;
      } else if (pollCount % 10 === 0 && pollCount > 0) {
        // Log periodic updates even without status change (every ~30s)
        const elapsed = formatElapsed(buildStart);
        logProgress(`   Still ${currentStatus}... (${elapsed})`, options);
      }

      // Check for terminal states
      if (blueprint.status === "build_complete") {
        logProgress(
          `\n✅ [3/3] Build completed successfully! (${formatElapsed(buildStart)})`,
          options,
        );
        logProgress(`\n🎉 Blueprint "${options.name}" is ready!`, options);
        logProgress(`   Total time: ${formatElapsed(startTime)}`, options);
        logProgress(`   Blueprint ID: ${blueprint.id}\n`, options);
        output(blueprint, { format: options.output, defaultFormat: "json" });
        return;
      }

      if (blueprint.status === "failed") {
        logProgress(
          `\n❌ [3/3] Build failed (${formatElapsed(buildStart)})`,
          options,
        );
        if (blueprint.failure_reason) {
          logProgress(`   Reason: ${blueprint.failure_reason}`, options);
        }
        logProgress(
          `   View logs with: rli blueprint logs ${blueprint.id}\n`,
          options,
        );
        outputError(`Blueprint build failed. Status: ${blueprint.status}`);
      }

      // Wait before next poll (3 seconds)
      await new Promise((resolve) => setTimeout(resolve, 3000));
      pollCount++;
    }
  } catch (error) {
    logProgress(`\n❌ Failed after ${formatElapsed(startTime)}`, options);
    outputError("Failed to create blueprint from Dockerfile", error);
  }
}

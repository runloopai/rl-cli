#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import Runloop from "@runloop/api-client";
import Conf from "conf";

// Client configuration
interface Config {
  apiKey?: string;
}

let configInstance: Conf<Config> | null = null;

function getConfigInstance(): Conf<Config> {
  if (!configInstance) {
    configInstance = new Conf<Config>({
      projectName: "runloop-cli",
    });
  }
  return configInstance;
}

function getConfig(): Config {
  // Check environment variable first
  const envApiKey = process.env.RUNLOOP_API_KEY;
  if (envApiKey) {
    return { apiKey: envApiKey };
  }

  // Fall back to stored config
  try {
    const config = getConfigInstance();
    const apiKey = config.get("apiKey");
    return { apiKey };
  } catch (error) {
    console.error("Warning: Failed to load config:", error);
    return {};
  }
}

function getBaseUrl(): string {
  const env = process.env.RUNLOOP_ENV?.toLowerCase();

  switch (env) {
    case "dev":
      return "https://api.runloop.pro";
    case "prod":
    default:
      return "https://api.runloop.ai";
  }
}

function getClient(): Runloop {
  const config = getConfig();

  if (!config.apiKey) {
    throw new Error(
      "API key not configured. Please set RUNLOOP_API_KEY environment variable or run: rli auth",
    );
  }

  const baseURL = getBaseUrl();

  return new Runloop({
    bearerToken: config.apiKey,
    baseURL,
    timeout: 10000, // 10 seconds instead of default 30 seconds
    maxRetries: 2, // 2 retries instead of default 5 (only for retryable errors)
  });
}

// Define available tools for the MCP server
const TOOLS: Tool[] = [
  {
    name: "list_devboxes",
    description: "List all devboxes with optional filtering by status",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description:
            "Filter by status (running, provisioning, suspended, etc.)",
          enum: [
            "running",
            "provisioning",
            "initializing",
            "suspended",
            "shutdown",
            "failure",
          ],
        },
        limit: {
          type: "number",
          description: "Maximum number of devboxes to return",
        },
      },
    },
  },
  {
    name: "get_devbox",
    description: "Get detailed information about a specific devbox by ID",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The devbox ID",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_devbox",
    description: "Create a new devbox with specified configuration",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the devbox",
        },
        blueprint_id: {
          type: "string",
          description: "Blueprint ID to use as template",
        },
        snapshot_id: {
          type: "string",
          description: "Snapshot ID to restore from",
        },
        entrypoint: {
          type: "string",
          description: "Entrypoint script to run on startup",
        },
        environment_variables: {
          type: "object",
          description: "Environment variables as key-value pairs",
        },
        resource_size: {
          type: "string",
          description: "Resource size (SMALL, MEDIUM, LARGE, XLARGE)",
          enum: ["SMALL", "MEDIUM", "LARGE", "XLARGE"],
        },
        keep_alive_seconds: {
          type: "number",
          description: "Keep alive time in seconds",
        },
      },
    },
  },
  {
    name: "execute_command",
    description: "Execute a command on a devbox and get the result",
    inputSchema: {
      type: "object",
      properties: {
        devbox_id: {
          type: "string",
          description: "The devbox ID to execute the command on",
        },
        command: {
          type: "string",
          description: "The command to execute",
        },
      },
      required: ["devbox_id", "command"],
    },
  },
  {
    name: "shutdown_devbox",
    description: "Shutdown a devbox by ID",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The devbox ID to shutdown",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "suspend_devbox",
    description: "Suspend a devbox by ID",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The devbox ID to suspend",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "resume_devbox",
    description: "Resume a suspended devbox by ID",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The devbox ID to resume",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "list_blueprints",
    description: "List all available blueprints",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of blueprints to return",
        },
      },
    },
  },
  {
    name: "list_snapshots",
    description: "List all snapshots",
    inputSchema: {
      type: "object",
      properties: {
        devbox_id: {
          type: "string",
          description: "Filter snapshots by devbox ID",
        },
        limit: {
          type: "number",
          description: "Maximum number of snapshots to return",
        },
      },
    },
  },
  {
    name: "create_snapshot",
    description: "Create a snapshot of a devbox",
    inputSchema: {
      type: "object",
      properties: {
        devbox_id: {
          type: "string",
          description: "The devbox ID to snapshot",
        },
        name: {
          type: "string",
          description: "Name for the snapshot",
        },
      },
      required: ["devbox_id"],
    },
  },
];

// Create the MCP server
const server = new Server(
  {
    name: "runloop-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const client = getClient();

    if (!args) {
      throw new Error("Missing arguments");
    }

    switch (name) {
      case "list_devboxes": {
        const result = await client.devboxes.list({
          status: args.status as any,
          limit: args.limit as number,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_devbox": {
        const result = await client.devboxes.retrieve(args.id as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "create_devbox": {
        const createParams: any = {};
        if (args.name) createParams.name = args.name;
        if (args.blueprint_id) createParams.blueprint_id = args.blueprint_id;
        if (args.snapshot_id) createParams.snapshot_id = args.snapshot_id;
        if (args.entrypoint) createParams.entrypoint = args.entrypoint;
        if (args.environment_variables)
          createParams.environment_variables = args.environment_variables;
        if (args.resource_size) {
          createParams.launch_parameters = {
            resource_size_request: args.resource_size,
          };
        }
        if (args.keep_alive_seconds) {
          if (!createParams.launch_parameters)
            createParams.launch_parameters = {};
          createParams.launch_parameters.keep_alive_time_seconds =
            args.keep_alive_seconds;
        }

        const result = await client.devboxes.create(createParams);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "execute_command": {
        const result = await client.devboxes.executeSync(
          args.devbox_id as string,
          {
            command: args.command as string,
          },
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "shutdown_devbox": {
        const result = await client.devboxes.shutdown(args.id as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "suspend_devbox": {
        const result = await client.devboxes.suspend(args.id as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "resume_devbox": {
        const result = await client.devboxes.resume(args.id as string);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_blueprints": {
        const result = await client.blueprints.list({
          limit: args.limit as number,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "list_snapshots": {
        const params: any = {};
        if (args.devbox_id) params.devbox_id = args.devbox_id;

        const allSnapshots: any[] = [];
        let count = 0;
        const limit = (args.limit as number) || 100;

        for await (const snapshot of client.devboxes.listDiskSnapshots(
          params,
        )) {
          allSnapshots.push(snapshot);
          count++;
          if (count >= limit) break;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(allSnapshots, null, 2),
            },
          ],
        };
      }

      case "create_snapshot": {
        const params: any = {};
        if (args.name) params.name = args.name;

        const result = await client.devboxes.snapshotDisk(
          args.devbox_id as string,
          params,
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  try {
    console.error("[MCP] Starting Runloop MCP server...");
    const transport = new StdioServerTransport();
    console.error("[MCP] Created stdio transport");

    await server.connect(transport);
    console.error("[MCP] Server connected to transport");

    // Log to stderr so it doesn't interfere with MCP protocol on stdout
    console.error("[MCP] Runloop MCP server running on stdio");

    // Keep the process alive - the stdio transport should keep it running
    console.error(
      "[MCP] Server initialization complete, waiting for requests...",
    );
  } catch (error) {
    console.error("[MCP] Error in main():", error);
    throw error;
  }
}

main().catch((error) => {
  console.error("[MCP] Fatal error in main():", error);
  console.error(
    "[MCP] Stack trace:",
    error instanceof Error ? error.stack : "N/A",
  );
  process.exit(1);
});

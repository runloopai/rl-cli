#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  DevboxCreateParams,
  DevboxListDiskSnapshotsParams,
  DevboxListParams,
  DevboxSnapshotDiskParams,
  DevboxSnapshotView,
} from "@runloop/api-client/resources/devboxes/devboxes.js";
import { getClient } from "../utils/client.js";
import express from "express";
import { processUtils } from "../utils/processUtils.js";

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
        const listParams: DevboxListParams = {};
        if (args.status != null)
          listParams.status = args.status as DevboxListParams["status"];
        if (args.limit != null) listParams.limit = args.limit as number;
        const result = await client.devboxes.list(listParams);
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
        const createParams: DevboxCreateParams = {};
        if (args.name) createParams.name = args.name as string;
        if (args.blueprint_id)
          createParams.blueprint_id = args.blueprint_id as string;
        if (args.snapshot_id)
          createParams.snapshot_id = args.snapshot_id as string;
        if (args.entrypoint)
          createParams.entrypoint = args.entrypoint as string;
        if (args.environment_variables)
          createParams.environment_variables =
            args.environment_variables as Record<string, string>;
        if (args.resource_size) {
          type Size =
            | "X_SMALL"
            | "SMALL"
            | "MEDIUM"
            | "LARGE"
            | "X_LARGE"
            | "XX_LARGE"
            | "CUSTOM_SIZE";
          createParams.launch_parameters = {
            resource_size_request: args.resource_size as Size,
          };
        }
        if (args.keep_alive_seconds) {
          createParams.launch_parameters = {
            ...createParams.launch_parameters,
            keep_alive_time_seconds: args.keep_alive_seconds as number,
          };
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
        const params: DevboxListDiskSnapshotsParams = {};
        if (args.devbox_id) params.devbox_id = args.devbox_id as string;

        const allSnapshots: DevboxSnapshotView[] = [];
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
        const params: DevboxSnapshotDiskParams = {};
        if (args.name) params.name = args.name as string;

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the HTTP/SSE server
async function main() {
  const app = express();
  const port = parseInt(process.env.PORT || "3000");

  // Handle SSE endpoint
  app.get("/sse", async (req, res) => {
    console.log("New SSE connection established");

    const transport = new SSEServerTransport("/message", res);
    await server.connect(transport);

    // Keep connection alive
    req.on("close", () => {
      console.log("SSE connection closed");
    });
  });

  // Handle message endpoint for client requests
  app.post("/message", express.json(), async (req, res) => {
    // The SSE transport handles this automatically
    res.status(200).end();
  });

  app.listen(port, () => {
    console.log(`Runloop MCP HTTP server running on http://localhost:${port}`);
    console.log(`SSE endpoint: http://localhost:${port}/sse`);
    console.log(`Message endpoint: http://localhost:${port}/message`);
  });
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  processUtils.exit(1);
});

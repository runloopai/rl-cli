#!/usr/bin/env node
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { processUtils } from "../utils/processUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function startMcpServer() {
  // Get the path to the compiled MCP server
  const serverPath = join(__dirname, "../mcp/server.js");

  // Start the MCP server as a child process
  // The server uses stdio transport, so it communicates via stdin/stdout
  const serverProcess = spawn("node", [serverPath], {
    stdio: "inherit", // Pass through stdin/stdout/stderr
  });

  serverProcess.on("error", (error) => {
    console.error("Failed to start MCP server:", error);
    processUtils.exit(1);
  });

  serverProcess.on("exit", (code) => {
    if (code !== 0) {
      console.error(`MCP server exited with code ${code}`);
      processUtils.exit(code || 1);
    }
  });

  // Handle Ctrl+C
  processUtils.on("SIGINT", () => {
    serverProcess.kill("SIGINT");
    processUtils.exit(0);
  });
}

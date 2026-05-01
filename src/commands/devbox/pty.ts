import WebSocket from "ws";
import { cliStatus } from "../../utils/cliStatus.js";
import { outputError } from "../../utils/output.js";
import { processUtils } from "../../utils/processUtils.js";
import { waitForReady } from "../../utils/ssh.js";
import {
  getPtyBaseUrl,
  ptyConnect,
  ptyControl,
  buildWsUrl,
  createPtyTunnel,
  getPtyTunnelBaseUrl,
  isLocalPtyOverride,
  buildWsHeaders,
} from "../../lib/pty-client.js";

interface PtyOptions {
  session?: string;
  command?: string;
  wait?: boolean;
  timeout?: string;
  pollInterval?: string;
  output?: string;
}

export async function ptyDevbox(devboxId: string, options: PtyOptions = {}) {
  try {
    if (options.wait !== false) {
      cliStatus(`Waiting for devbox ${devboxId} to be ready...`);
      const isReady = await waitForReady(
        devboxId,
        parseInt(options.timeout || "180"),
        parseInt(options.pollInterval || "3"),
      );
      if (!isReady) {
        outputError(`Devbox ${devboxId} is not ready. Please try again later.`);
      }
    }

    let baseUrl: string;
    let authToken: string | undefined;

    if (isLocalPtyOverride()) {
      baseUrl = getPtyBaseUrl();
    } else {
      cliStatus(`Creating PTY tunnel for ${devboxId}...`);
      const tunnel = await createPtyTunnel(devboxId);
      baseUrl = getPtyTunnelBaseUrl(tunnel.tunnel_key);
      authToken = tunnel.auth_token;
    }

    const sessionName = options.session || devboxId;

    if (options.command) {
      await execCommand(baseUrl, sessionName, options.command, authToken);
    } else {
      await interactiveSession(baseUrl, sessionName, authToken);
    }
  } catch (error) {
    outputError("Failed to start PTY session", error);
  }
}

async function execCommand(
  baseUrl: string,
  sessionName: string,
  command: string,
  authToken?: string,
): Promise<void> {
  const connectResponse = await ptyConnect(baseUrl, sessionName, {
    cols: 80,
    rows: 24,
    authToken,
  });

  const wsUrl = buildWsUrl(baseUrl, connectResponse.connect_url);

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: buildWsHeaders(authToken) });

    ws.on("open", () => {
      ws.send(command + "\n");
    });

    ws.on("message", (data: WebSocket.Data) => {
      if (Buffer.isBuffer(data)) {
        process.stdout.write(data);
      } else if (data instanceof ArrayBuffer) {
        process.stdout.write(Buffer.from(data));
      } else if (Array.isArray(data)) {
        process.stdout.write(Buffer.concat(data));
      } else {
        process.stdout.write(String(data));
      }
    });

    ws.on("close", () => {
      resolve();
    });

    ws.on("error", (err: Error) => {
      reject(err);
    });
  });
}

async function interactiveSession(
  baseUrl: string,
  sessionName: string,
  authToken?: string,
): Promise<void> {
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;

  const connectResponse = await ptyConnect(baseUrl, sessionName, {
    cols,
    rows,
    authToken,
  });

  const wsUrl = buildWsUrl(baseUrl, connectResponse.connect_url);

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { headers: buildWsHeaders(authToken) });

    const cleanup = () => {
      process.stdin.removeListener("data", onStdinData);
      process.removeListener("SIGWINCH", onResize);
      if (processUtils.stdin.isTTY && processUtils.stdin.setRawMode) {
        processUtils.stdin.setRawMode(false);
      }
      process.stdin.pause();
    };

    const onStdinData = (data: Buffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    };

    const onResize = () => {
      const newCols = process.stdout.columns || 80;
      const newRows = process.stdout.rows || 24;
      ptyControl(
        baseUrl,
        sessionName,
        {
          action: "resize",
          cols: newCols,
          rows: newRows,
        },
        authToken,
      ).catch(() => {});
    };

    ws.on("open", () => {
      if (processUtils.stdin.isTTY && processUtils.stdin.setRawMode) {
        processUtils.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.on("data", onStdinData);
      process.on("SIGWINCH", onResize);
    });

    ws.on("message", (data: WebSocket.Data) => {
      if (Buffer.isBuffer(data)) {
        process.stdout.write(data);
      } else if (data instanceof ArrayBuffer) {
        process.stdout.write(Buffer.from(data));
      } else if (Array.isArray(data)) {
        process.stdout.write(Buffer.concat(data));
      } else {
        process.stdout.write(String(data));
      }
    });

    ws.on("close", () => {
      cleanup();
      resolve();
    });

    ws.on("error", (err: Error) => {
      cleanup();
      reject(err);
    });
  });
}

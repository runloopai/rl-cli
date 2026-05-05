import WebSocket from "ws";
import { cliStatus } from "../../utils/cliStatus.js";
import { outputError } from "../../utils/output.js";
import { processUtils } from "../../utils/processUtils.js";
import { waitForReady } from "../../utils/ssh.js";
import {
  getPtyBaseUrl,
  ptyControl,
  ptyNotifyClosed,
  resolvePtyWebSocketUrl,
  createPtyTunnel,
  getPtyTunnelBaseUrl,
  isLocalPtyOverride,
  buildWsHeaders,
  settleAfterPtyTunnel,
} from "../../lib/pty-client.js";
import { openPtyWebSocket } from "../../lib/pty-ws.js";

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
      await settleAfterPtyTunnel();
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
  const wsUrl = await resolvePtyWebSocketUrl(baseUrl, sessionName, {
    cols: 80,
    rows: 24,
    authToken,
  });
  const ws = await openPtyWebSocket(wsUrl, buildWsHeaders(authToken));
  ws.send(command + "\n");

  return new Promise<void>((resolve, reject) => {
    let released = false;
    const notifyClosedOnce = () => {
      if (released) return;
      released = true;
      ptyNotifyClosed(baseUrl, sessionName, authToken);
    };

    const onSigint = () => {
      notifyClosedOnce();
      process.removeListener("SIGINT", onSigint);
      process.removeListener("SIGTERM", onSigterm);
      ws.close();
    };
    const onSigterm = () => {
      notifyClosedOnce();
      process.removeListener("SIGINT", onSigint);
      process.removeListener("SIGTERM", onSigterm);
      ws.close();
    };
    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);

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
      notifyClosedOnce();
      process.removeListener("SIGINT", onSigint);
      process.removeListener("SIGTERM", onSigterm);
      resolve();
    });

    ws.on("error", (err: Error) => {
      notifyClosedOnce();
      process.removeListener("SIGINT", onSigint);
      process.removeListener("SIGTERM", onSigterm);
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

  const wsUrl = await resolvePtyWebSocketUrl(baseUrl, sessionName, {
    cols,
    rows,
    authToken,
  });
  const ws = await openPtyWebSocket(wsUrl, buildWsHeaders(authToken));

  return new Promise<void>((resolve, reject) => {
    let released = false;
    const notifyClosedOnce = () => {
      if (released) return;
      released = true;
      ptyNotifyClosed(baseUrl, sessionName, authToken);
    };

    const onSigint = () => {
      notifyClosedOnce();
      process.removeListener("SIGINT", onSigint);
      process.removeListener("SIGTERM", onSigterm);
      ws.close();
    };
    const onSigterm = () => {
      notifyClosedOnce();
      process.removeListener("SIGINT", onSigint);
      process.removeListener("SIGTERM", onSigterm);
      ws.close();
    };
    process.on("SIGINT", onSigint);
    process.on("SIGTERM", onSigterm);

    const cleanup = () => {
      process.removeListener("SIGINT", onSigint);
      process.removeListener("SIGTERM", onSigterm);
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

    if (processUtils.stdin.isTTY && processUtils.stdin.setRawMode) {
      processUtils.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.on("data", onStdinData);
    process.on("SIGWINCH", onResize);

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
      notifyClosedOnce();
      cleanup();
      resolve();
    });

    ws.on("error", (err: Error) => {
      notifyClosedOnce();
      cleanup();
      reject(err);
    });
  });
}

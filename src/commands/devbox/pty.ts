import WebSocket from "ws";
import { cliStatus } from "../../utils/cliStatus.js";
import { outputError } from "../../utils/output.js";
import { processUtils } from "../../utils/processUtils.js";
import { waitForReady } from "../../utils/ssh.js";
import {
  getPtyBaseUrl,
  ptyControl,
  createPtySessionReleaser,
  resolvePtyWebSocketUrl,
  createPtyTunnel,
  getPtyTunnelBaseUrl,
  isLocalPtyOverride,
  buildWsHeaders,
  settleAfterPtyTunnel,
  refreshPtySessionAfterAttach,
} from "../../lib/pty-client.js";
import { openPtyWebSocket } from "../../lib/pty-ws.js";

/** SIGINT/SIGTERM → optional notify then close socket; returns disposer for ws close/error cleanup. */
function registerPtyInterruptHandlers(
  ws: WebSocket,
  beforeClose: () => void,
): () => void {
  function dispose() {
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGTERM", onSigterm);
  }
  function onSigint() {
    beforeClose();
    dispose();
    ws.close();
  }
  function onSigterm() {
    beforeClose();
    dispose();
    ws.close();
  }
  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
  return dispose;
}

function writePtyStreamToStdout(data: WebSocket.Data): void {
  if (Buffer.isBuffer(data)) {
    process.stdout.write(data);
  } else if (data instanceof ArrayBuffer) {
    process.stdout.write(Buffer.from(data));
  } else if (Array.isArray(data)) {
    process.stdout.write(Buffer.concat(data));
  } else {
    process.stdout.write(String(data));
  }
}

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

    const sessionName = options.session?.trim() || devboxId;

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
  await refreshPtySessionAfterAttach(
    ws,
    baseUrl,
    sessionName,
    80,
    24,
    authToken,
  );
  ws.send(command + "\n");

  return new Promise<void>((resolve, reject) => {
    const releaseOnce = createPtySessionReleaser(
      baseUrl,
      sessionName,
      authToken,
    );
    const disposeInterruptSignals = registerPtyInterruptHandlers(
      ws,
      releaseOnce,
    );

    ws.on("message", (data: WebSocket.Data) => {
      writePtyStreamToStdout(data);
    });

    ws.on("close", () => {
      releaseOnce();
      disposeInterruptSignals();
      resolve();
    });

    ws.on("error", (err: Error) => {
      releaseOnce();
      disposeInterruptSignals();
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
  await refreshPtySessionAfterAttach(
    ws,
    baseUrl,
    sessionName,
    cols,
    rows,
    authToken,
  );

  return new Promise<void>((resolve, reject) => {
    const releaseOnce = createPtySessionReleaser(
      baseUrl,
      sessionName,
      authToken,
    );
    const disposeInterruptSignals = registerPtyInterruptHandlers(
      ws,
      releaseOnce,
    );

    const cleanup = () => {
      disposeInterruptSignals();
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
      writePtyStreamToStdout(data);
    });

    ws.on("close", () => {
      releaseOnce();
      cleanup();
      resolve();
    });

    ws.on("error", (err: Error) => {
      releaseOnce();
      cleanup();
      reject(err);
    });
  });
}

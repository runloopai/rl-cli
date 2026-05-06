import WebSocket from "ws";
import { cliStatus } from "../../utils/cliStatus.js";
import { outputError } from "../../utils/output.js";
import { waitForReady } from "../../utils/ssh.js";
import {
  getPtyBaseUrl,
  createPtySessionReleaser,
  resolvePtyWebSocketUrl,
  createPtyTunnel,
  getPtyTunnelBaseUrl,
  isLocalPtyOverride,
  settleAfterPtyTunnel,
  refreshPtySessionAfterAttach,
  startPtyIoSession,
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

function writePtyStreamToStdout(data: WebSocket.RawData): void {
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

const PTY_EXEC_TIMEOUT_MS = (() => {
  const v = parseInt(process.env.RUNLOOP_PTY_EXEC_TIMEOUT_MS || "0", 10);
  return isNaN(v) || v < 0 ? 0 : v;
})();

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
  const ws = await openPtyWebSocket(wsUrl, authToken);
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

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (PTY_EXEC_TIMEOUT_MS > 0) {
      timeoutId = setTimeout(() => {
        releaseOnce();
        ws.close();
      }, PTY_EXEC_TIMEOUT_MS);
    }

    const finish = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      releaseOnce();
      disposeInterruptSignals();
    };

    ws.on("message", (data: WebSocket.RawData) => {
      writePtyStreamToStdout(data);
    });

    ws.on("close", () => {
      finish();
      resolve();
    });

    ws.on("error", (err: Error) => {
      finish();
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
  const ws = await openPtyWebSocket(wsUrl, authToken);
  await refreshPtySessionAfterAttach(
    ws,
    baseUrl,
    sessionName,
    cols,
    rows,
    authToken,
  );

  const releaseOnce = createPtySessionReleaser(baseUrl, sessionName, authToken);
  const { dispose, done } = startPtyIoSession(
    ws,
    baseUrl,
    sessionName,
    authToken,
  );
  const disposeSignals = registerPtyInterruptHandlers(ws, releaseOnce);

  try {
    await done;
    releaseOnce();
  } catch (err) {
    releaseOnce();
    throw err;
  } finally {
    dispose();
    disposeSignals();
  }
}

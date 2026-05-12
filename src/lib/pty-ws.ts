import type { ClientRequest, IncomingMessage } from "http";
import WebSocket from "ws";

const PTY_WS_MAX_ATTEMPTS = Math.max(
  1,
  parseInt(process.env.RUNLOOP_PTY_WS_RETRIES || "3", 10) || 3,
);

/**
 * Per-attempt connect timeout. Kept short so the worst-case wall-clock spent
 * stacking ptyConnect (up to 3 × 10s back-off) and WS attach retries stays
 * bounded; override via env if a slow tunnel ever needs it.
 */
const PTY_WS_CONNECT_TIMEOUT_MS = (() => {
  const raw = parseInt(
    process.env.RUNLOOP_PTY_WS_CONNECT_TIMEOUT_MS || "15000",
    10,
  );
  return Number.isFinite(raw) && raw > 0 ? raw : 15_000;
})();

/**
 * Tunnel-edge HTTP statuses worth retrying on WebSocket upgrade. 502/503 are
 * emitted by the mux while the upstream Rage REST listener is still warming up.
 */
const RETRYABLE_UPGRADE_STATUS = /HTTP\s+(502|503)\b/;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function connectWebSocketOnce(
  wsUrl: string,
  protocols: string[] | undefined,
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, protocols ?? []);
    let settled = false;

    const connectTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.terminate();
      reject(new Error("WebSocket connection timed out"));
    }, PTY_WS_CONNECT_TIMEOUT_MS);

    function finish(ok: boolean, result: WebSocket | Error) {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimer);
      if (ok) resolve(result as WebSocket);
      else reject(result as Error);
    }

    ws.once("open", () => finish(true, ws));

    ws.once(
      "unexpected-response",
      (_req: ClientRequest, res: IncomingMessage) => {
        const code = res.statusCode ?? 0;
        finish(
          false,
          new Error(
            `WebSocket upgrade failed: HTTP ${code} ${res.statusMessage ?? ""}`.trim(),
          ),
        );
      },
    );

    ws.once("error", (err: Error) => finish(false, err));
  });
}

/**
 * Connect to PTY attach URL; retries HTTP 502/503 from tunnel edge during warm-up.
 * authToken is passed as a WebSocket subprotocol (Sec-WebSocket-Protocol) so it
 * is not visible in server access logs as a URL query parameter.
 */
export async function openPtyWebSocket(
  wsUrl: string,
  authToken: string | undefined,
): Promise<WebSocket> {
  const protocols = authToken ? [authToken] : undefined;
  let lastErr: Error | undefined;

  for (let attempt = 1; attempt <= PTY_WS_MAX_ATTEMPTS; attempt++) {
    try {
      return await connectWebSocketOnce(wsUrl, protocols);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const retryable = RETRYABLE_UPGRADE_STATUS.test(lastErr.message);

      if (!retryable || attempt === PTY_WS_MAX_ATTEMPTS) {
        throw lastErr;
      }

      const delayMs = Math.min(10_000, 400 * 2 ** (attempt - 1));
      await delay(delayMs);
    }
  }

  throw lastErr ?? new Error("WebSocket connect failed");
}

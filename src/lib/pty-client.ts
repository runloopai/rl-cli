import { baseUrl, getConfig } from "../utils/config.js";
import { getTunnelUrl } from "../utils/url.js";

const PTY_CONNECT_MAX_ATTEMPTS = Math.max(
  1,
  parseInt(process.env.RUNLOOP_PTY_CONNECT_RETRIES || "3", 10) || 3,
);

/** Optional pause after `create_pty_tunnel` so the mux can route (ms). `0` disables. */
export async function settleAfterPtyTunnel(): Promise<void> {
  const ms = Math.max(
    0,
    parseInt(process.env.RUNLOOP_PTY_POST_TUNNEL_MS || "1500", 10) || 0,
  );
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

function ptyBootstrapTokenInQuery(): boolean {
  const v =
    process.env.RUNLOOP_PTY_BOOTSTRAP_TOKEN_IN_QUERY?.toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}

function ptyBootstrapConnectionClose(): boolean {
  const v =
    process.env.RUNLOOP_PTY_BOOTSTRAP_CONNECTION_CLOSE?.toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}

async function readErrorSnippet(res: Response): Promise<string> {
  try {
    const t = (await res.text()).trim();
    if (!t) return "";
    return t.length > 500 ? `${t.slice(0, 500)}…` : t;
  } catch {
    return "";
  }
}

function formatHttpError(
  prefix: string,
  res: Response,
  detail: string,
): string {
  return detail
    ? `${prefix}: ${res.status} ${res.statusText} — ${detail}`
    : `${prefix}: ${res.status} ${res.statusText}`;
}

/**
 * Rage REST port on real devboxes (PTY HTTP + WebSocket). Matches platform
 * `RAGE_REST_PORT` in Java/K8s; not configurable in normal flows.
 *
 * MUX PTY origins use {@link getPtyTunnelBaseUrl}: `https://13-{tunnel_key}.tunnel.<domain>`
 * (via {@link getTunnelUrl}). Must include the `tunnel.` label — not `13-{key}.<domain>`.
 * Local PTY tests use an ephemeral port on 127.0.0.1 instead (`RUNLOOP_PTY_URL`).
 */
export const RAGE_REST_PORT = 13 as const;

/** Default local PTY dev server when `RUNLOOP_PTY_URL` is unset (bazel `//src/test/pty:test_bin`). */
export const PTY_BASE_URL_LOCAL = "http://localhost:5000";

export interface PtyConnectResponse {
  session_name: string;
  status: string;
  protocol_version: string;
  connect_url: string;
  created: boolean;
  attached: boolean;
  cols: number;
  rows: number;
  idle_ttl_seconds: number;
}

export interface PtyControlResult {
  session_name: string;
  status: string;
}

export interface PtyTunnelView {
  tunnel_key: string;
  auth_token: string;
}

export type ControlAction =
  | { action: "resize"; cols: number; rows: number }
  | { action: "signal"; signal: string }
  | { action: "close" };

export async function createPtyTunnel(
  devboxId: string,
): Promise<PtyTunnelView> {
  const apiKey = getConfig().apiKey;
  if (!apiKey) throw new Error("API key not configured");

  const url = `${baseUrl()}/v1/devboxes/${encodeURIComponent(devboxId)}/create_pty_tunnel`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) {
    const detail = await readErrorSnippet(res);
    throw new Error(formatHttpError("Create PTY tunnel failed", res, detail));
  }
  return res.json() as Promise<PtyTunnelView>;
}

/**
 * Public origin for PTY after `create_pty_tunnel` (MUX): `https://13-{tunnel_key}.tunnel.<domain>`
 * (same `{port}-{key}.tunnel…` shape as port-forward tunnels, with port fixed at
 * {@link RAGE_REST_PORT}). Paths are still `GET /pty/{session_name}`, WebSocket `…/attach`, etc.
 */
export function getPtyTunnelBaseUrl(tunnelKey: string): string {
  return getTunnelUrl(RAGE_REST_PORT, tunnelKey);
}

export function isLocalPtyOverride(): boolean {
  return !!process.env.RUNLOOP_PTY_URL?.trim();
}

export function buildWsHeaders(
  authToken?: string,
): Record<string, string> | undefined {
  if (!authToken) return undefined;
  return { Authorization: `Bearer ${authToken}` };
}

export function getPtyBaseUrl(): string {
  const override = process.env.RUNLOOP_PTY_URL?.trim();
  if (override) return override;

  // Production uses `create_pty_tunnel` + `getPtyTunnelBaseUrl`; this matches the local test server default.
  return PTY_BASE_URL_LOCAL;
}

/** `GET /pty/{session}` bootstrap (JSON + `connect_url`). Required before WebSocket attach unless `RUNLOOP_PTY_ATTACH_ONLY=1`. */
export async function ptyConnect(
  baseUrl: string,
  sessionName: string,
  opts?: { cols?: number; rows?: number; authToken?: string },
): Promise<PtyConnectResponse> {
  const params = new URLSearchParams();
  if (opts?.cols) params.set("cols", String(opts.cols));
  if (opts?.rows) params.set("rows", String(opts.rows));
  if (opts?.authToken && ptyBootstrapTokenInQuery()) {
    params.set("token", opts.authToken);
  }

  const qs = params.toString();
  const pathSession = encodeURIComponent(sessionName);
  const url = `${baseUrl}/pty/${pathSession}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "Runloop-rli/pty-bootstrap",
  };
  if (opts?.authToken) {
    headers["Authorization"] = `Bearer ${opts.authToken}`;
  }
  if (opts?.authToken && ptyBootstrapConnectionClose()) {
    headers["Connection"] = "close";
  }

  for (let attempt = 1; attempt <= PTY_CONNECT_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) {
      return res.json() as Promise<PtyConnectResponse>;
    }

    let detail = await readErrorSnippet(res);
    if (res.status === 502) {
      const hint =
        "Tunnel 502 usually means Rage REST is unreachable from the mux (same URL with curl typically matches).";
      detail = detail ? `${detail} — ${hint}` : hint;
    }
    const msg = formatHttpError("PTY connect failed", res, detail);
    const retryable = res.status === 502 || res.status === 503;

    if (retryable && attempt < PTY_CONNECT_MAX_ATTEMPTS) {
      const delayMs = Math.min(10_000, 400 * 2 ** (attempt - 1));
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    throw new Error(msg);
  }

  throw new Error("PTY connect failed: exhausted retries");
}

export async function ptyControl(
  baseUrl: string,
  sessionName: string,
  action: ControlAction,
  authToken?: string,
): Promise<PtyControlResult> {
  const url = `${baseUrl}/pty/${encodeURIComponent(sessionName)}/control`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(action),
  });
  if (!res.ok) {
    const detail = await readErrorSnippet(res);
    throw new Error(formatHttpError("PTY control failed", res, detail));
  }
  return res.json() as Promise<PtyControlResult>;
}

/** Best-effort: release the PTY session on the server so the same session name can attach again. */
export function ptyNotifyClosed(
  baseUrl: string,
  sessionName: string,
  authToken?: string,
): void {
  void ptyControl(baseUrl, sessionName, { action: "close" }, authToken).catch(
    () => {},
  );
}

/** Calls {@link ptyNotifyClosed} at most once (ws close, signals, Ink unmount, etc.). */
export function createPtySessionReleaser(
  baseUrl: string,
  sessionName: string,
  authToken?: string,
): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    ptyNotifyClosed(baseUrl, sessionName, authToken);
  };
}

/** Same numeric value as `WebSocket.OPEN` from the `ws` package. */
const WS_READY_STATE_OPEN = 1;

/**
 * After the attach WebSocket is open: re-send terminal size (refreshes session geometry)
 * and send CR so the shell redraws the prompt (avoids a blank display until the user hits Enter).
 */
export async function refreshPtySessionAfterAttach(
  ws: { readyState: number; send(data: string | Buffer): void },
  baseUrl: string,
  sessionName: string,
  cols: number,
  rows: number,
  authToken?: string,
): Promise<void> {
  await ptyControl(
    baseUrl,
    sessionName,
    { action: "resize", cols, rows },
    authToken,
  ).catch(() => {});
  if (ws.readyState === WS_READY_STATE_OPEN) {
    ws.send("\r");
  }
}

/** WebSocket attach URL; adds `?token=` when `authToken` is set (tunnel WS upgrade). */
export function buildWsUrl(
  baseUrl: string,
  connectUrl: string,
  authToken?: string,
): string {
  const parsed = new URL(baseUrl);
  const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  let path = connectUrl;
  if (authToken) {
    const sep = connectUrl.includes("?") ? "&" : "?";
    path = `${connectUrl}${sep}token=${encodeURIComponent(authToken)}`;
  }
  return `${protocol}//${parsed.host}${path}`;
}

/**
 * Path for WebSocket attach only (no prior `GET /pty/{session}` bootstrap).
 * Optional `cols` / `rows` match query params supported on upgrade.
 */
export function buildPtyAttachPath(
  sessionName: string,
  cols?: number,
  rows?: number,
): string {
  const params = new URLSearchParams();
  if (cols) params.set("cols", String(cols));
  if (rows) params.set("rows", String(rows));
  const qs = params.toString();
  return `/pty/${encodeURIComponent(sessionName)}/attach${qs ? `?${qs}` : ""}`;
}

/** Full `wss:` URL for PTY streaming with no HTTP bootstrap (experimental). */
export function buildPtyAttachWsUrl(
  baseUrl: string,
  sessionName: string,
  opts?: { cols?: number; rows?: number; authToken?: string },
): string {
  const path = buildPtyAttachPath(sessionName, opts?.cols, opts?.rows);
  const wsUrl = buildWsUrl(baseUrl, path, opts?.authToken);
  return wsUrl;
}

export function isPtyAttachOnlyMode(): boolean {
  const v = process.env.RUNLOOP_PTY_ATTACH_ONLY?.toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Resolves the WebSocket URL: by default `ptyConnect` bootstrap then `connect_url`;
 * if `RUNLOOP_PTY_ATTACH_ONLY=1`, opens `/pty/.../attach` directly (often 502 if server requires bootstrap).
 */
export async function resolvePtyWebSocketUrl(
  baseUrl: string,
  sessionName: string,
  opts: { cols: number; rows: number; authToken?: string },
): Promise<string> {
  if (isPtyAttachOnlyMode()) {
    return buildPtyAttachWsUrl(baseUrl, sessionName, opts);
  }
  const connectResponse = await ptyConnect(baseUrl, sessionName, {
    cols: opts.cols,
    rows: opts.rows,
    authToken: opts.authToken,
  });
  const wsUrl = buildWsUrl(
    baseUrl,
    connectResponse.connect_url,
    opts.authToken,
  );
  return wsUrl;
}

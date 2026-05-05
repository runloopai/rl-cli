import { baseUrl, getConfig } from "../utils/config.js";
import { getTunnelUrl } from "../utils/url.js";

/** Tunnel port for the PTY / rage REST plane (see Runloop PTY usage guide). */
export const PTY_TUNNEL_REST_PORT = 13;

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
  });
  if (!res.ok) {
    throw new Error(
      `Create PTY tunnel failed: ${res.status} ${res.statusText}`,
    );
  }
  return res.json() as Promise<PtyTunnelView>;
}

export function getPtyTunnelBaseUrl(tunnelKey: string): string {
  return getTunnelUrl(PTY_TUNNEL_REST_PORT, tunnelKey);
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

export async function ptyConnect(
  baseUrl: string,
  sessionName: string,
  opts?: { cols?: number; rows?: number; authToken?: string },
): Promise<PtyConnectResponse> {
  const params = new URLSearchParams();
  if (opts?.cols) params.set("cols", String(opts.cols));
  if (opts?.rows) params.set("rows", String(opts.rows));

  const qs = params.toString();
  const url = `${baseUrl}/pty/${sessionName}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {};
  if (opts?.authToken) {
    headers["Authorization"] = `Bearer ${opts.authToken}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`PTY connect failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<PtyConnectResponse>;
}

export async function ptyControl(
  baseUrl: string,
  sessionName: string,
  action: ControlAction,
  authToken?: string,
): Promise<PtyControlResult> {
  const url = `${baseUrl}/pty/${sessionName}/control`;
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
    throw new Error(`PTY control failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<PtyControlResult>;
}

export function buildWsUrl(baseUrl: string, connectUrl: string): string {
  const parsed = new URL(baseUrl);
  const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${parsed.host}${connectUrl}`;
}

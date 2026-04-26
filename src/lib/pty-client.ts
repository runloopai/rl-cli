import { runloopBaseDomain } from "../utils/config.js";

// TODO: Update when PTY server URLs are finalized for production
export const PTY_BASE_URL_PROD = "https://pty.runloop.ai";
export const PTY_BASE_URL_DEV = "https://pty.runloop.pro";
export const PTY_BASE_URL_LOCAL = "http://localhost:8080";

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

export type ControlAction =
  | { action: "resize"; cols: number; rows: number }
  | { action: "signal"; signal: string }
  | { action: "close" };

export function getPtyBaseUrl(): string {
  const override = process.env.RUNLOOP_PTY_URL?.trim();
  if (override) return override;

  // TODO: Derive from base domain once PTY server hostnames are finalized
  const domain = runloopBaseDomain();
  return `https://pty.${domain}`;
}

export async function ptyConnect(
  baseUrl: string,
  sessionName: string,
  opts?: { cols?: number; rows?: number },
): Promise<PtyConnectResponse> {
  const params = new URLSearchParams();
  if (opts?.cols) params.set("cols", String(opts.cols));
  if (opts?.rows) params.set("rows", String(opts.rows));

  const qs = params.toString();
  const url = `${baseUrl}/pty/${sessionName}${qs ? `?${qs}` : ""}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`PTY connect failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<PtyConnectResponse>;
}

export async function ptyControl(
  baseUrl: string,
  sessionName: string,
  action: ControlAction,
): Promise<PtyControlResult> {
  const url = `${baseUrl}/pty/${sessionName}/control`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

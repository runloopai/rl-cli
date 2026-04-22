import Conf from "conf";
import { homedir } from "os";
import { join } from "path";
import { existsSync, statSync, mkdirSync, writeFileSync } from "fs";

interface Config {
  apiKey?: string;
  theme?: "auto" | "light" | "dark";
  detectedTheme?: "light" | "dark";
}

const config = new Conf<Config>({
  projectName: "runloop-cli",
  cwd: join(homedir(), ".runloop"),
});

export function getConfig(): Config {
  // Check environment variable first, then fall back to stored config
  const apiKey = process.env.RUNLOOP_API_KEY || config.get("apiKey");

  return {
    apiKey,
  };
}

export function setApiKey(apiKey: string): void {
  config.set("apiKey", apiKey);
}

export function clearConfig(): void {
  config.clear();
}

/**
 * Bare domain suffix from `RUNLOOP_BASE_URL`, e.g. `runloop.ai` or `example.com`.
 * Full URLs, `api.*` hostnames, paths, ports, or invalid hostnames → null (use RUNLOOP_ENV).
 */
function runloopBaseDomainOrNull(): string | null {
  const raw = process.env.RUNLOOP_BASE_URL?.trim();
  if (!raw) return null;
  if (/:\/\//.test(raw) || /\s/.test(raw) || raw.includes("/")) {
    return null;
  }
  if (raw.includes(":")) {
    return null;
  }
  const domain = raw.toLowerCase();
  if (!isValidBareDomain(domain)) {
    return null;
  }
  return domain;
}

function isValidBareDomain(domain: string): boolean {
  if (domain.length === 0 || domain.length > 253) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  if (!domain.includes(".")) return false;
  const labels = domain.split(".");
  for (const label of labels) {
    if (label.length === 0 || label.length > 63) return false;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) return false;
  }
  return true;
}

function prefixedHost(prefix: string, domain: string): string {
  return `${prefix}.${domain}`;
}

/**
 * HTTP base URL for the Runloop API (used by the CLI client and MCP).
 *
 * - If `RUNLOOP_BASE_URL` is a valid bare domain, uses `https://api.<domain>`.
 * - Else `RUNLOOP_ENV=dev` → https://api.runloop.pro; otherwise production.
 */
export function baseUrl(): string {
  const domain = runloopBaseDomainOrNull();
  if (domain) {
    return `https://${prefixedHost("api", domain)}`;
  }
  return process.env.RUNLOOP_ENV === "dev"
    ? "https://api.runloop.pro"
    : "https://api.runloop.ai";
}

/**
 * Web platform origin for deep links (settings, devbox pages in the browser).
 */
export function platformBaseUrl(): string {
  const domain = runloopBaseDomainOrNull();
  if (domain) {
    return `https://${prefixedHost("platform", domain)}`;
  }
  return process.env.RUNLOOP_ENV === "dev"
    ? "https://platform.runloop.pro"
    : "https://platform.runloop.ai";
}

/** Hostname for devbox tunnel URLs (`{port}-{key}.<host>`). */
export function tunnelBaseHostname(): string {
  const domain = runloopBaseDomainOrNull();
  if (domain) {
    return prefixedHost("tunnel", domain);
  }
  return process.env.RUNLOOP_ENV === "dev"
    ? "tunnel.runloop.pro"
    : "tunnel.runloop.ai";
}

/** SSH gateway hostname (TLS/SNI), without port. */
export function sshGatewayHostname(): string {
  const domain = runloopBaseDomainOrNull();
  if (domain) {
    return prefixedHost("ssh", domain);
  }
  return process.env.RUNLOOP_ENV === "dev"
    ? "ssh.runloop.pro"
    : "ssh.runloop.ai";
}

/**
 * `host:443` for `openssl s_client -connect` (SSH over HTTPS).
 */
export function sshUrl(): string {
  return `${sshGatewayHostname()}:443`;
}

export function getCacheDir(): string {
  return join(homedir(), ".runloop", "rl-cli");
}

export function shouldCheckForUpdates(): boolean {
  const cacheDir = getCacheDir();
  const cacheFile = join(cacheDir, "last_update_check");

  if (!existsSync(cacheFile)) {
    return true;
  }

  const stats = statSync(cacheFile);
  const daysSinceUpdate =
    (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceUpdate >= 1;
}

export function updateCheckCache(): void {
  const cacheDir = getCacheDir();
  const cacheFile = join(cacheDir, "last_update_check");

  // Create cache directory if it doesn't exist
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  // Touch the cache file
  writeFileSync(cacheFile, "");
}

export function getThemePreference(): "auto" | "light" | "dark" {
  // Check environment variable first, then fall back to stored config
  const envTheme = process.env.RUNLOOP_THEME?.toLowerCase();
  if (envTheme === "light" || envTheme === "dark" || envTheme === "auto") {
    return envTheme;
  }

  return config.get("theme") || "auto";
}

export function setThemePreference(theme: "auto" | "light" | "dark"): void {
  config.set("theme", theme);
}

export function getDetectedTheme(): "light" | "dark" | null {
  return config.get("detectedTheme") || null;
}

export function setDetectedTheme(theme: "light" | "dark"): void {
  config.set("detectedTheme", theme);
}

export function clearDetectedTheme(): void {
  config.delete("detectedTheme");
}

/**
 * Check if beta features are enabled via the RL_CLI_BETA environment variable.
 * Set RL_CLI_BETA=1 or RL_CLI_BETA=true to enable beta features.
 */
export function isBetaEnabled(): boolean {
  const betaValue = process.env.RL_CLI_BETA?.toLowerCase();
  return betaValue === "1" || betaValue === "true";
}

/**
 * Returns the detailed error message for when the API key is not configured.
 * This message provides instructions on how to set up the API key.
 */
export function getApiKeyErrorMessage(): string {
  return `
❌ API key not configured.

To get started:
1. Go to https://platform.runloop.ai/settings and create an API key
2. Set the environment variable:

   export RUNLOOP_API_KEY=your_api_key_here

To make it permanent, add this line to your shell config:
   • For zsh:  echo 'export RUNLOOP_API_KEY=your_api_key_here' >> ~/.zshrc
   • For bash: echo 'export RUNLOOP_API_KEY=your_api_key_here' >> ~/.bashrc

Then restart your terminal or run: source ~/.zshrc (or ~/.bashrc)
`;
}

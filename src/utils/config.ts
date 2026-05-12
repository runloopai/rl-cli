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

const DEFAULT_BASE_URL = "https://api.runloop.ai";
const DEFAULT_BASE_DOMAIN = "runloop.ai";
let _cachedBaseDomain: string | null = null;

/**
 * Validate RUNLOOP_BASE_URL at startup. If set, it must be a well-formed
 * `https://api.<domain>` URL. Exits with an error if malformed. No-op if unset.
 */
export function checkBaseDomain(): void {
  const raw = process.env.RUNLOOP_BASE_URL?.trim();
  if (!raw) return;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    console.error(
      `Error: RUNLOOP_BASE_URL is not a valid URL: ${raw}\n` +
        `Expected format: https://api.<domain> (e.g. https://api.runloop.ai)`,
    );
    process.exit(1);
  }

  if (parsed.protocol !== "https:") {
    console.error(
      `Error: RUNLOOP_BASE_URL must use https, got ${parsed.protocol}\n` +
        `Expected format: https://api.<domain>`,
    );
    process.exit(1);
  }

  if (!parsed.hostname.startsWith("api.") || parsed.hostname === "api.") {
    console.error(
      `Error: RUNLOOP_BASE_URL hostname must start with "api." followed by a domain: ${raw}\n` +
        `Expected format: https://api.<domain> (e.g. https://api.runloop.ai)`,
    );
    process.exit(1);
  }

  if (
    parsed.port ||
    parsed.pathname.replace(/\/+$/, "") ||
    parsed.search ||
    parsed.hash
  ) {
    console.error(
      `Error: RUNLOOP_BASE_URL must not contain port, path, query, or fragment: ${raw}\n` +
        `Expected format: https://api.<domain>`,
    );
    process.exit(1);
  }
}

/**
 * Returns the bare domain from RUNLOOP_BASE_URL (e.g. "runloop.ai" from
 * "https://api.runloop.ai"). Defaults to "runloop.ai" when unset.
 */
export function runloopBaseDomain(): string {
  if (_cachedBaseDomain !== null) return _cachedBaseDomain;

  const raw = process.env.RUNLOOP_BASE_URL?.trim();
  if (!raw) {
    _cachedBaseDomain = DEFAULT_BASE_DOMAIN;
    return _cachedBaseDomain;
  }

  try {
    const hostname = new URL(raw).hostname;
    _cachedBaseDomain = hostname.startsWith("api.")
      ? hostname.slice(4)
      : hostname;
  } catch {
    _cachedBaseDomain = DEFAULT_BASE_DOMAIN;
  }

  return _cachedBaseDomain;
}

/** @internal — for tests only */
export function _resetBaseDomainCache(): void {
  _cachedBaseDomain = null;
}

/** Full API base URL from RUNLOOP_BASE_URL, or the default. */
export function baseUrl(): string {
  return process.env.RUNLOOP_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

/** Web platform origin for deep links (settings, devbox pages). */
export function platformBaseUrl(): string {
  return `https://platform.${runloopBaseDomain()}`;
}

/** Hostname for devbox tunnel URLs (`{port}-{key}.tunnel.<domain>`). */
export function tunnelBaseHostname(): string {
  return `tunnel.${runloopBaseDomain()}`;
}

/** SSH gateway hostname (TLS/SNI), without port. */
export function sshGatewayHostname(): string {
  return `ssh.${runloopBaseDomain()}`;
}

/** `host:443` for `openssl s_client -connect` (SSH over HTTPS). */
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
1. Go to ${platformBaseUrl()}/settings and create an API key
2. Set the environment variable:

   export RUNLOOP_API_KEY=your_api_key_here

To make it permanent, add this line to your shell config:
   • For zsh:  echo 'export RUNLOOP_API_KEY=your_api_key_here' >> ~/.zshrc
   • For bash: echo 'export RUNLOOP_API_KEY=your_api_key_here' >> ~/.bashrc

Restart your terminal or run \`source ~/.zshrc\` / \`source ~/.bashrc\` so the variable is picked up.
`;
}

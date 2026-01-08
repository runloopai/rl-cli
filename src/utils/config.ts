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

export function baseUrl(): string {
  return process.env.RUNLOOP_ENV === "dev"
    ? "https://api.runloop.pro"
    : "https://api.runloop.ai";
}

export function sshUrl(): string {
  return process.env.RUNLOOP_ENV === "dev"
    ? "ssh.runloop.pro:443"
    : "ssh.runloop.ai:443";
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

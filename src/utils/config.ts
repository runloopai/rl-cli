import Conf from "conf";
import { homedir } from "os";
import { join } from "path";
import { existsSync, statSync, mkdirSync, writeFileSync } from "fs";

interface Config {
  apiKey?: string;
}

const config = new Conf<Config>({
  projectName: "runloop-cli",
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
  return join(homedir(), ".cache", "rl-cli");
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

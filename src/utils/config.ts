import Conf from "conf";
import { homedir } from "os";
import { join } from "path";
import { existsSync, statSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

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

export function getCurrentVersion(): string {
  try {
    // First try environment variable (when installed via npm)
    if (process.env.npm_package_version) {
      return process.env.npm_package_version;
    }
    
    // Fall back to reading package.json directly
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // When running from dist/, we need to go up two levels to find package.json
    const packageJsonPath = join(__dirname, "../../package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return packageJson.version;
  } catch (error) {
    // Ultimate fallback
    return "0.1.0";
  }
}

export function shouldCheckForUpdates(): boolean {
  const cacheDir = getCacheDir();
  const cacheFile = join(cacheDir, "last_update_check");

  if (!existsSync(cacheFile)) {
    return true;
  }

  const stats = statSync(cacheFile);
  const hoursSinceUpdate =
    (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

  return hoursSinceUpdate >= 6;
}

export function hasCachedUpdateInfo(): boolean {
  const cacheDir = getCacheDir();
  const cacheFile = join(cacheDir, "last_update_check");
  return existsSync(cacheFile);
}

export function updateCheckCache(latestVersion: string): void {
  const cacheDir = getCacheDir();
  const cacheFile = join(cacheDir, "last_update_check");

  // Create cache directory if it doesn't exist
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true });
  }

  // Store the latest version in the cache file
  writeFileSync(cacheFile, latestVersion);
}

export function getCachedLatestVersion(): string | null {
  const cacheDir = getCacheDir();
  const cacheFile = join(cacheDir, "last_update_check");
  
  if (!existsSync(cacheFile)) {
    return null;
  }
  
  try {
    return readFileSync(cacheFile, 'utf-8').trim();
  } catch {
    return null;
  }
}

export async function checkForUpdates(force: boolean = false): Promise<void> {
  const currentVersion = getCurrentVersion();
  
  // Always show cached result if available and not forcing
  if (!force && hasCachedUpdateInfo() && !shouldCheckForUpdates()) {
    const cachedLatestVersion = getCachedLatestVersion();
    if (cachedLatestVersion && cachedLatestVersion !== currentVersion) {
      // Check if current version is older than cached latest
      const isUpdateAvailable = compareVersions(cachedLatestVersion, currentVersion) > 0;
      
      if (isUpdateAvailable) {
        console.error(
          `\n🔄 Update available: ${currentVersion} → ${cachedLatestVersion}\n` +
          `   Run: npm install -g @runloop/rl-cli@latest\n\n`
        );
      }
    }
    return;
  }
  
  // Only fetch from npm if cache is expired or forcing
  if (!force && !shouldCheckForUpdates()) {
    return;
  }

  try {
    const response = await fetch("https://registry.npmjs.org/@runloop/rl-cli/latest");
    
    if (!response.ok) {
      if (force) {
        console.error("❌ Failed to check for updates\n");
      }
      return; // Silently fail if we can't check
    }
    
    const data = await response.json() as { version: string };
    const latestVersion = data.version;
    
    if (force) {
      console.error(`Current version: ${currentVersion}\n`);
      console.error(`Latest version: ${latestVersion}\n`);
    }
    
    if (latestVersion && latestVersion !== currentVersion) {
      // Check if current version is older than latest
      const isUpdateAvailable = compareVersions(latestVersion, currentVersion) > 0;
      
      if (isUpdateAvailable) {
        console.error(
          `\n🔄 Update available: ${currentVersion} → ${latestVersion}\n` +
          `   Run: npm install -g @runloop/rl-cli@latest\n\n`
        );
      } else if (force) {
        console.error("✅ You're running the latest version!\n");
      }
    } else if (force) {
      console.error("✅ You're running the latest version!\n");
    }
    
    // Update the cache with the latest version
    updateCheckCache(latestVersion);
  } catch (error) {
    if (force) {
      console.error(`❌ Error checking for updates: ${error}\n`);
    }
    // Silently fail - don't interrupt the user's workflow
  }
}

function compareVersions(version1: string, version2: string): number {
  const v1parts = version1.split('.').map(Number);
  const v2parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
    const v1part = v1parts[i] || 0;
    const v2part = v2parts[i] || 0;
    
    if (v1part > v2part) return 1;
    if (v1part < v2part) return -1;
  }
  
  return 0;
}

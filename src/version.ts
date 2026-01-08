/**
 * Version information for the CLI.
 * Separated from cli.ts to allow importing without side effects.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf8"),
);

export const VERSION: string = packageJson.version;

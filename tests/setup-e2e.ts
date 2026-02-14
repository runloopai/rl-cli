/**
 * Minimal setup for e2e tests.
 *
 * Unlike the unit-test setup, this does NOT mock the API client, services,
 * or console — everything runs against the real Runloop API.
 *
 * Credentials come from the environment (e.g. via `rldev`).
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";

// Load .env file if it exists
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath });
}

// Ensure required env vars are present
if (!process.env.RUNLOOP_API_KEY) {
  throw new Error(
    "RUNLOOP_API_KEY is required for e2e tests. " +
      "Run `rldev` first or set the environment variable.",
  );
}

process.env.RUNLOOP_ENV = process.env.RUNLOOP_ENV || "dev";

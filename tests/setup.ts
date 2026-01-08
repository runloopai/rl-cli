// Load environment variables from .env file if it exists
import { jest } from "@jest/globals";
import { config } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";

// Load .env file if it exists
const envPath = join(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath });
}

// Mock console methods for cleaner test output (only for unit tests)
if (!process.env.RUN_E2E) {
  const originalConsole = global.console;
  global.console = {
    ...originalConsole,
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

// Mock process.exit to prevent test runner from exiting (only for unit tests)
if (!process.env.RUN_E2E) {
  const originalExit = process.exit;
  process.exit = jest.fn() as any;
}

// Add pending function for integration tests
global.pending = (reason?: string) => {
  throw new Error(`Test pending: ${reason || "No reason provided"}`);
};

// Mock interactive command runner to prevent Ink issues in tests
jest.mock("../src/utils/interactiveCommand.js", () => ({
  runInteractiveCommand: jest.fn(async (fn) => {
    // Just run the function directly without Ink
    return await fn();
  }),
}));

// Mock Ink components to prevent raw mode issues
jest.mock("ink", () => ({
  render: jest.fn(),
  Box: ({ children }: any) => children,
  Text: ({ children }: any) => children,
  useInput: jest.fn(),
  useStdout: jest.fn(() => ({ stdout: { write: jest.fn() } })),
  useStderr: jest.fn(() => ({ stderr: { write: jest.fn() } })),
  useFocus: jest.fn(),
  useFocusManager: jest.fn(),
  useApp: jest.fn(),
  measureElement: jest.fn(),
  useMeasure: jest.fn(),
}));

// Mock ESM-only Ink dependencies so Jest doesn't parse their ESM bundles
jest.mock("ink-big-text", () => ({ __esModule: true, default: () => null }));
jest.mock("ink-gradient", () => ({ __esModule: true, default: () => null }));

// Mock app UI components that import Ink deps, to avoid pulling in ESM from node_modules
jest.mock("../src/components/Banner.tsx", () => ({
  __esModule: true,
  Banner: () => null,
}));
jest.mock("../src/components/Header.tsx", () => ({
  __esModule: true,
  Header: () => null,
}));
jest.mock("../src/components/Spinner.tsx", () => ({
  __esModule: true,
  SpinnerComponent: () => null,
}));
jest.mock("../src/components/SuccessMessage.tsx", () => ({
  __esModule: true,
  SuccessMessage: () => null,
}));
jest.mock("../src/components/ErrorMessage.tsx", () => ({
  __esModule: true,
  ErrorMessage: () => null,
}));

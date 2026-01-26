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

// Set default test environment variables
process.env.RUNLOOP_ENV = process.env.RUNLOOP_ENV || "dev";
process.env.RUNLOOP_API_KEY = process.env.RUNLOOP_API_KEY || "ak_test_key";
process.env.RUNLOOP_BASE_URL =
  process.env.RUNLOOP_BASE_URL || "https://api.runloop.pro";
process.env.NODE_ENV = process.env.NODE_ENV || "test";

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

// Mock client to avoid API calls
jest.mock("../src/utils/client.ts", () => ({
  getClient: jest.fn(() => ({
    devboxes: {
      create: jest.fn().mockResolvedValue({ id: "test-id", status: "running" }),
      list: jest.fn().mockResolvedValue({ data: [] }),
      executions: {
        executeAsync: jest
          .fn()
          .mockResolvedValue({ id: "exec-123", status: "running" }),
        retrieve: jest.fn().mockResolvedValue({
          status: "completed",
          stdout: "test output",
          stderr: "",
          exit_status: 0,
        }),
        kill: jest.fn().mockResolvedValue({}),
        awaitCompleted: jest.fn().mockResolvedValue({
          status: "completed",
          stdout: "test output",
          stderr: "",
          exit_status: 0,
        }),
        streamStdoutUpdates: jest.fn().mockResolvedValue({
          [Symbol.asyncIterator]: () => ({
            next: jest.fn().mockResolvedValue({ value: undefined, done: true }),
          }),
        }),
        streamStderrUpdates: jest.fn().mockResolvedValue({
          [Symbol.asyncIterator]: () => ({
            next: jest.fn().mockResolvedValue({ value: undefined, done: true }),
          }),
        }),
      },
    },
  })),
}));

// Mock services to avoid API calls
jest.mock("../src/services/devboxService.ts", () => ({
  devboxService: {
    list: jest.fn().mockResolvedValue({ devboxes: [], hasMore: false }),
    get: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: "test-id" }),
    delete: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  },
  getDevboxLogs: jest.fn().mockResolvedValue([]),
  execCommand: jest
    .fn()
    .mockResolvedValue({ stdout: "", stderr: "", exit_code: 0 }),
  execCommandAsync: jest
    .fn()
    .mockResolvedValue({ executionId: "exec-123", status: "running" }),
  getExecution: jest.fn().mockResolvedValue({
    status: "completed",
    stdout: "test output",
    stderr: "",
    exit_status: 0,
  }),
  killExecution: jest.fn().mockResolvedValue(undefined),
  suspendDevbox: jest.fn().mockResolvedValue(undefined),
  resumeDevbox: jest.fn().mockResolvedValue(undefined),
  shutdownDevbox: jest.fn().mockResolvedValue(undefined),
  uploadFile: jest.fn().mockResolvedValue(undefined),
  createSnapshot: jest.fn().mockResolvedValue({ id: "snap-test" }),
  createTunnel: jest.fn().mockResolvedValue({ url: "https://tunnel.test" }),
  createSSHKey: jest
    .fn()
    .mockResolvedValue({ ssh_private_key: "key", url: "test" }),
  getDevbox: jest.fn().mockResolvedValue(null),
}));

// Mock zustand stores
jest.mock("../src/store/devboxStore.ts", () => ({
  useDevboxStore: jest.fn(() => ({
    devboxes: [],
    loading: false,
    error: null,
    fetchDevboxes: jest.fn(),
    selectedDevbox: null,
    setSelectedDevbox: jest.fn(),
  })),
}));

// Mock navigation store
jest.mock("../src/store/navigationStore", () => ({
  useNavigationStore: jest.fn(() => ({
    currentRoute: "/",
    navigate: jest.fn(),
    goBack: jest.fn(),
    breadcrumbs: [],
  })),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
    currentScreen: "home",
    params: {},
  })),
}));

// Mock hooks
jest.mock("../src/hooks/useViewportHeight.ts", () => ({
  useViewportHeight: jest.fn(() => ({
    viewportHeight: 20,
    terminalHeight: 24,
    terminalWidth: 80,
  })),
}));

jest.mock("../src/hooks/useExitOnCtrlC.ts", () => ({
  useExitOnCtrlC: jest.fn(),
}));

// Mock theme
jest.mock("../src/utils/theme.ts", () => ({
  colors: {
    primary: "#00ff00",
    secondary: "#0000ff",
    success: "#00ff00",
    error: "#ff0000",
    warning: "#ffff00",
    info: "#00ffff",
    text: "#ffffff",
    textDim: "#888888",
    border: "#444444",
    background: "#000000",
    accent1: "#ff00ff",
    accent2: "#00ffff",
    accent3: "#ffff00",
    idColor: "#888888",
  },
  isLightMode: jest.fn(() => false),
  getChalkColor: jest.fn(() => "#ffffff"),
  getChalkTextColor: jest.fn(() => (text: string) => text),
  sanitizeWidth: jest.fn((width: number, min?: number, max?: number) =>
    Math.max(min || 1, Math.min(width, max || 100)),
  ),
}));

// Mock logFormatter
jest.mock("../src/utils/logFormatter.ts", () => ({
  parseAnyLogEntry: jest.fn(
    (log: { level?: string; source?: string; message?: string }) => ({
      timestamp: new Date().toISOString(),
      level: log.level || "INFO",
      source: log.source || "system",
      message: log.message || "",
      levelColor: "gray",
      sourceColor: "gray",
      cmd: null,
      exitCode: null,
      shellName: null,
    }),
  ),
}));

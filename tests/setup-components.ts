/**
 * Test setup for component tests using ink-testing-library.
 * This setup does NOT mock Ink, allowing real rendering tests.
 */

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

// Mock console methods for cleaner test output
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  error: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Mock processUtils to prevent actual process.exit calls in tests
jest.mock("../src/utils/processUtils", () => ({
  processUtils: {
    exit: jest.fn((code?: number) => {
      throw new Error(`process.exit(${code}) called`);
    }),
    stdout: {
      write: jest.fn(() => true),
      isTTY: false,
    },
    stderr: {
      write: jest.fn(() => true),
      isTTY: false,
    },
    stdin: {
      isTTY: false,
      setRawMode: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
    },
    cwd: jest.fn(() => "/mock/cwd"),
    on: jest.fn(),
    off: jest.fn(),
    env: process.env,
  },
  resetProcessUtils: jest.fn(),
  createMockProcessUtils: jest.fn(),
  installMockProcessUtils: jest.fn(),
}));

// Mock signal-exit to avoid ESM teardown issues
jest.mock("signal-exit", () => ({
  __esModule: true,
  default: jest.fn(() => () => {}),
  onExit: jest.fn(() => () => {}),
}));

// Mock ESM-only dependencies that cause issues
jest.mock("figures", () => ({
  __esModule: true,
  default: {
    tick: "✓",
    cross: "✗",
    bullet: "●",
    circle: "○",
    circleFilled: "●",
    circleDotted: "◌",
    ellipsis: "…",
    questionMarkPrefix: "?",
    arrowRight: "→",
    arrowDown: "↓",
    arrowUp: "↑",
    arrowLeft: "←",
    pointer: "❯",
    pointerSmall: "›",
    info: "ℹ",
    warning: "⚠",
    hamburger: "☰",
    play: "▶",
    squareSmallFilled: "◼",
    identical: "≡",
  },
}));

jest.mock("conf", () => {
  return {
    __esModule: true,
    default: class MockConf {
      private store: Record<string, unknown> = {};
      get(key: string) {
        return this.store[key];
      }
      set(key: string, value: unknown) {
        this.store[key] = value;
      }
      delete(key: string) {
        delete this.store[key];
      }
      has(key: string) {
        return key in this.store;
      }
      clear() {
        this.store = {};
      }
    },
  };
});

// Mock ink-spinner to avoid ESM issues
jest.mock("ink-spinner", () => ({
  __esModule: true,
  default: () => null,
}));

// Mock ink-big-text and ink-gradient (these cause ESM issues)
jest.mock("ink-big-text", () => ({ __esModule: true, default: () => null }));
jest.mock("ink-gradient", () => ({ __esModule: true, default: () => null }));

// Note: We do NOT mock 'ink' - we use ink-testing-library which needs real ink

// Mock ink-text-input
jest.mock("ink-text-input", () => ({
  __esModule: true,
  default: ({ value, placeholder }: { value?: string; placeholder?: string }) =>
    value || placeholder || "",
}));

// Mock services to avoid API calls during tests
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

jest.mock("../src/services/blueprintService.ts", () => ({
  blueprintService: {
    list: jest.fn().mockResolvedValue({ blueprints: [], hasMore: false }),
    get: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock("../src/services/snapshotService.ts", () => ({
  snapshotService: {
    list: jest.fn().mockResolvedValue({ snapshots: [], hasMore: false }),
    get: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock("../src/services/mcpConfigService.ts", () => ({
  listMcpConfigs: jest
    .fn()
    .mockResolvedValue({ mcpConfigs: [], totalCount: 0, hasMore: false }),
  getMcpConfig: jest.fn().mockResolvedValue(null),
  getMcpConfigByIdOrName: jest.fn().mockResolvedValue(null),
  createMcpConfig: jest.fn().mockResolvedValue({ id: "mcp_test" }),
  updateMcpConfig: jest.fn().mockResolvedValue({ id: "mcp_test" }),
  deleteMcpConfig: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/services/gatewayConfigService.ts", () => ({
  listGatewayConfigs: jest
    .fn()
    .mockResolvedValue({ gatewayConfigs: [], totalCount: 0, hasMore: false }),
  getGatewayConfig: jest.fn().mockResolvedValue(null),
  getGatewayConfigByIdOrName: jest.fn().mockResolvedValue(null),
  createGatewayConfig: jest.fn().mockResolvedValue({ id: "gwc_test" }),
  updateGatewayConfig: jest.fn().mockResolvedValue({ id: "gwc_test" }),
  deleteGatewayConfig: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../src/services/networkPolicyService.ts", () => ({
  listNetworkPolicies: jest
    .fn()
    .mockResolvedValue({ networkPolicies: [], totalCount: 0, hasMore: false }),
  getNetworkPolicy: jest.fn().mockResolvedValue(null),
  deleteNetworkPolicy: jest.fn().mockResolvedValue(undefined),
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

jest.mock("../src/store/mcpConfigStore.ts", () => ({
  useMcpConfigStore: jest.fn((selector?: (state: any) => any) => {
    const state = {
      mcpConfigs: [],
      loading: false,
      initialLoading: false,
      error: null,
      currentPage: 0,
      pageSize: 10,
      totalCount: 0,
      hasMore: false,
      searchQuery: "",
      selectedIndex: 0,
      clearAll: jest.fn(),
      setMcpConfigs: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock("../src/store/gatewayConfigStore.ts", () => ({
  useGatewayConfigStore: jest.fn((selector?: (state: any) => any) => {
    const state = {
      gatewayConfigs: [],
      loading: false,
      initialLoading: false,
      error: null,
      currentPage: 0,
      pageSize: 10,
      totalCount: 0,
      hasMore: false,
      searchQuery: "",
      selectedIndex: 0,
      clearAll: jest.fn(),
      setGatewayConfigs: jest.fn(),
      setLoading: jest.fn(),
      setError: jest.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

// Note: navigationStore is .tsx not .ts - mock both possible import paths
jest.mock("../src/store/navigationStore", () => ({
  useNavigationStore: jest.fn(() => ({
    currentRoute: "/",
    navigate: jest.fn(),
    goBack: jest.fn(),
    breadcrumbs: [],
  })),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
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

jest.mock("../src/hooks/useUpdateCheck.ts", () => ({
  useUpdateCheck: jest.fn(() => ({
    isChecking: false,
    updateAvailable: null,
    currentVersion: "0.1.0",
  })),
}));

// Mock version.ts VERSION export
jest.mock("../src/version", () => ({
  VERSION: "0.1.0",
}));

// Mock theme utilities
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

// Mock url utility
jest.mock("../src/utils/url.ts", () => ({
  getDevboxUrl: jest.fn((id: string) => `https://runloop.ai/devbox/${id}`),
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

// Mock client
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
            next: jest
              .fn()
              .mockResolvedValueOnce({
                value: { output: "line 1\n", offset: 7 },
                done: false,
              })
              .mockResolvedValueOnce({ value: undefined, done: true }),
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

// Mock screen utilities
jest.mock("../src/utils/screen.ts", () => ({
  showCursor: jest.fn(),
  clearScreen: jest.fn(),
  enterAlternateScreenBuffer: jest.fn(),
}));

// Mock exec utility
jest.mock("../src/utils/exec.ts", () => ({
  execCommand: jest.fn(),
}));

// Mock Banner component (uses ink-big-text which is ESM)
jest.mock("../src/components/Banner.tsx", () => ({
  __esModule: true,
  Banner: () => null,
}));

// Mock UpdateNotification to avoid network calls during breadcrumb tests
jest.mock("../src/components/UpdateNotification.tsx", () => ({
  __esModule: true,
  UpdateNotification: () => null,
}));

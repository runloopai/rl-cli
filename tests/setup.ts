// Load environment variables from .env file if it exists
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Load .env file if it exists
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  config({ path: envPath });
}

// Set default test environment variables
process.env.RUNLOOP_ENV = process.env.RUNLOOP_ENV || 'dev';
process.env.RUNLOOP_API_KEY = process.env.RUNLOOP_API_KEY || 'ak_30tbdSzn9RNLxkrgpeT81';
process.env.RUNLOOP_BASE_URL = process.env.RUNLOOP_BASE_URL || 'https://api.runloop.pro';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

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
  throw new Error(`Test pending: ${reason || 'No reason provided'}`);
};

// Mock interactive command runner to prevent Ink issues in tests
jest.mock('../src/utils/interactiveCommand.js', () => ({
  runInteractiveCommand: jest.fn(async (fn) => {
    // Just run the function directly without Ink
    return await fn();
  }),
}));

// Mock Ink components to prevent raw mode issues
jest.mock('ink', () => ({
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

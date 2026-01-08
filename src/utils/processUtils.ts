/**
 * Process utilities wrapper for testability.
 *
 * This module provides a mockable interface for process-related operations
 * like exit, stdout/stderr writes, and terminal detection. In tests, you can
 * replace these functions with mocks to avoid actual process termination
 * and capture output.
 *
 * Usage in code:
 *   import { processUtils } from '../utils/processUtils.js';
 *   processUtils.exit(1);
 *   processUtils.stdout.write('Hello');
 *
 * Usage in tests:
 *   import { processUtils, resetProcessUtils } from '../utils/processUtils.js';
 *   processUtils.exit = jest.fn();
 *   // ... run tests ...
 *   resetProcessUtils(); // restore original behavior
 */

export interface ProcessUtils {
  /**
   * Exit the process with the given code.
   * In tests, this can be mocked to prevent actual exit.
   */
  exit: (code?: number) => never;

  /**
   * Standard output operations
   */
  stdout: {
    write: (data: string) => boolean;
    isTTY: boolean;
  };

  /**
   * Standard error operations
   */
  stderr: {
    write: (data: string) => boolean;
    isTTY: boolean;
  };

  /**
   * Standard input operations
   */
  stdin: {
    isTTY: boolean;
    setRawMode?: (mode: boolean) => void;
    on: (event: string, listener: (...args: unknown[]) => void) => void;
    removeListener: (
      event: string,
      listener: (...args: unknown[]) => void,
    ) => void;
  };

  /**
   * Get current working directory
   */
  cwd: () => string;

  /**
   * Register a handler for process events (e.g., 'SIGINT', 'exit')
   */
  on: (event: string, listener: (...args: unknown[]) => void) => void;

  /**
   * Remove a handler for process events
   */
  off: (event: string, listener: (...args: unknown[]) => void) => void;

  /**
   * Environment variables (read-only access)
   */
  env: typeof process.env;
}

// Store original references for reset
const originalExit = process.exit.bind(process);
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
const originalCwd = process.cwd.bind(process);
const originalOn = process.on.bind(process);
const originalOff = process.off.bind(process);

/**
 * The main process utilities object.
 * All properties are mutable for testing purposes.
 */
export const processUtils: ProcessUtils = {
  exit: originalExit,

  stdout: {
    write: (data: string) => originalStdoutWrite(data),
    get isTTY() {
      return process.stdout.isTTY ?? false;
    },
  },

  stderr: {
    write: (data: string) => originalStderrWrite(data),
    get isTTY() {
      return process.stderr.isTTY ?? false;
    },
  },

  stdin: {
    get isTTY() {
      return process.stdin.isTTY ?? false;
    },
    setRawMode: process.stdin.setRawMode?.bind(process.stdin),
    on: process.stdin.on.bind(process.stdin),
    removeListener: process.stdin.removeListener.bind(process.stdin),
  },

  cwd: originalCwd,

  on: originalOn,

  off: originalOff,

  get env() {
    return process.env;
  },
};

/**
 * Reset all process utilities to their original implementations.
 * Call this in test teardown to restore normal behavior.
 */
export function resetProcessUtils(): void {
  processUtils.exit = originalExit;
  processUtils.stdout.write = (data: string) => originalStdoutWrite(data);
  processUtils.stderr.write = (data: string) => originalStderrWrite(data);
  processUtils.cwd = originalCwd;
  processUtils.on = originalOn;
  processUtils.off = originalOff;
}

/**
 * Create a mock process utils for testing.
 * Returns an object with jest mock functions.
 */
export function createMockProcessUtils(): ProcessUtils {
  const exitMock = (() => {
    throw new Error("process.exit called");
  }) as (code?: number) => never;

  return {
    exit: exitMock,
    stdout: {
      write: () => true,
      isTTY: false,
    },
    stderr: {
      write: () => true,
      isTTY: false,
    },
    stdin: {
      isTTY: false,
      setRawMode: () => {},
      on: () => {},
      removeListener: () => {},
    },
    cwd: () => "/mock/cwd",
    on: () => {},
    off: () => {},
    env: {},
  };
}

/**
 * Install mock process utils for testing.
 * Returns a cleanup function to restore originals.
 */
export function installMockProcessUtils(
  mock: Partial<ProcessUtils>,
): () => void {
  const backup = {
    exit: processUtils.exit,
    stdoutWrite: processUtils.stdout.write,
    stderrWrite: processUtils.stderr.write,
    cwd: processUtils.cwd,
    on: processUtils.on,
    off: processUtils.off,
  };

  if (mock.exit) processUtils.exit = mock.exit;
  if (mock.stdout?.write) processUtils.stdout.write = mock.stdout.write;
  if (mock.stderr?.write) processUtils.stderr.write = mock.stderr.write;
  if (mock.cwd) processUtils.cwd = mock.cwd;
  if (mock.on) processUtils.on = mock.on;
  if (mock.off) processUtils.off = mock.off;

  return () => {
    processUtils.exit = backup.exit;
    processUtils.stdout.write = backup.stdoutWrite;
    processUtils.stderr.write = backup.stderrWrite;
    processUtils.cwd = backup.cwd;
    processUtils.on = backup.on;
    processUtils.off = backup.off;
  };
}

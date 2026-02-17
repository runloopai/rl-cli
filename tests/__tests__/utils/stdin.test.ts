/**
 * Tests for stdin utilities
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

// We need to mock process.stdin before importing the module
const mockStdin = {
  isTTY: false,
  setRawMode: jest.fn(),
  resume: jest.fn(),
  pause: jest.fn(),
  setEncoding: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  [Symbol.asyncIterator]: jest.fn(),
};

const mockStdout = {
  write: jest.fn(),
};

// Store original values
const originalStdin = process.stdin;
const originalStdout = process.stdout;

describe("stdin utilities", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Reset mock stdin state
    mockStdin.isTTY = false;
    mockStdin.setRawMode.mockClear();
    mockStdin.resume.mockClear();
    mockStdin.pause.mockClear();
    mockStdin.setEncoding.mockClear();
    mockStdin.on.mockClear();
    mockStdin.removeListener.mockClear();
    mockStdout.write.mockClear();
  });

  describe("readStdin", () => {
    it("should read and concatenate chunks from stdin", async () => {
      // Create an async iterator that yields chunks
      const chunks = [Buffer.from("hello "), Buffer.from("world")];
      let index = 0;

      const asyncIterator = {
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            if (index < chunks.length) {
              return { value: chunks[index++], done: false };
            }
            return { value: undefined, done: true };
          },
        }),
      };

      // Mock process.stdin as async iterable
      Object.defineProperty(process, "stdin", {
        value: asyncIterator,
        writable: true,
        configurable: true,
      });

      const { readStdin } = await import("../../../src/utils/stdin.js");
      const result = await readStdin();

      expect(result).toBe("hello world");
    });

    it("should trim whitespace from the result", async () => {
      const chunks = [Buffer.from("  secret-value  \n")];
      let index = 0;

      const asyncIterator = {
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            if (index < chunks.length) {
              return { value: chunks[index++], done: false };
            }
            return { value: undefined, done: true };
          },
        }),
      };

      Object.defineProperty(process, "stdin", {
        value: asyncIterator,
        writable: true,
        configurable: true,
      });

      const { readStdin } = await import("../../../src/utils/stdin.js");
      const result = await readStdin();

      expect(result).toBe("secret-value");
    });

    it("should return empty string for empty input", async () => {
      const asyncIterator = {
        [Symbol.asyncIterator]: () => ({
          next: async () => ({ value: undefined, done: true }),
        }),
      };

      Object.defineProperty(process, "stdin", {
        value: asyncIterator,
        writable: true,
        configurable: true,
      });

      const { readStdin } = await import("../../../src/utils/stdin.js");
      const result = await readStdin();

      expect(result).toBe("");
    });
  });

  describe("getSecretValue", () => {
    it("should use readStdin when stdin is not a TTY (piped input)", async () => {
      const chunks = [Buffer.from("piped-secret")];
      let index = 0;

      const asyncIterator = {
        isTTY: false,
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            if (index < chunks.length) {
              return { value: chunks[index++], done: false };
            }
            return { value: undefined, done: true };
          },
        }),
      };

      Object.defineProperty(process, "stdin", {
        value: asyncIterator,
        writable: true,
        configurable: true,
      });

      const { getSecretValue } = await import("../../../src/utils/stdin.js");
      const result = await getSecretValue();

      expect(result).toBe("piped-secret");
    });

    it("should handle multiline piped input", async () => {
      const chunks = [Buffer.from("line1\nline2\nline3")];
      let index = 0;

      const asyncIterator = {
        isTTY: false,
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            if (index < chunks.length) {
              return { value: chunks[index++], done: false };
            }
            return { value: undefined, done: true };
          },
        }),
      };

      Object.defineProperty(process, "stdin", {
        value: asyncIterator,
        writable: true,
        configurable: true,
      });

      const { getSecretValue } = await import("../../../src/utils/stdin.js");
      const result = await getSecretValue();

      expect(result).toBe("line1\nline2\nline3");
    });
  });

  describe("promptSecretValue", () => {
    it("should set up raw mode for interactive input", async () => {
      let dataCallback: ((char: string) => void) | null = null;

      const ttyStdin = {
        isTTY: true,
        setRawMode: jest.fn(),
        resume: jest.fn(),
        pause: jest.fn(),
        setEncoding: jest.fn(),
        on: jest.fn((event: string, cb: (char: string) => void) => {
          if (event === "data") {
            dataCallback = cb;
          }
        }),
        removeListener: jest.fn(),
      };

      Object.defineProperty(process, "stdin", {
        value: ttyStdin,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(process, "stdout", {
        value: mockStdout,
        writable: true,
        configurable: true,
      });

      const { promptSecretValue } = await import("../../../src/utils/stdin.js");

      // Start the prompt
      const promptPromise = promptSecretValue("Enter secret: ");

      // Wait for the event listener to be set up
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Simulate typing characters
      if (dataCallback) {
        dataCallback("s");
        dataCallback("e");
        dataCallback("c");
        dataCallback("r");
        dataCallback("e");
        dataCallback("t");
        dataCallback("\n"); // Enter key
      }

      const result = await promptPromise;

      expect(result).toBe("secret");
      expect(ttyStdin.setRawMode).toHaveBeenCalledWith(true);
      expect(ttyStdin.resume).toHaveBeenCalled();
      expect(ttyStdin.setEncoding).toHaveBeenCalledWith("utf8");
      // Should write asterisks for each character
      expect(mockStdout.write).toHaveBeenCalledWith("Enter secret: ");
      expect(mockStdout.write).toHaveBeenCalledWith("*");
    });

    it("should handle backspace correctly", async () => {
      let dataCallback: ((char: string) => void) | null = null;

      const ttyStdin = {
        isTTY: true,
        setRawMode: jest.fn(),
        resume: jest.fn(),
        pause: jest.fn(),
        setEncoding: jest.fn(),
        on: jest.fn((event: string, cb: (char: string) => void) => {
          if (event === "data") {
            dataCallback = cb;
          }
        }),
        removeListener: jest.fn(),
      };

      Object.defineProperty(process, "stdin", {
        value: ttyStdin,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(process, "stdout", {
        value: mockStdout,
        writable: true,
        configurable: true,
      });

      const { promptSecretValue } = await import("../../../src/utils/stdin.js");

      const promptPromise = promptSecretValue();

      await new Promise((resolve) => setTimeout(resolve, 10));

      if (dataCallback) {
        dataCallback("a");
        dataCallback("b");
        dataCallback("c");
        dataCallback("\u007F"); // Backspace (DEL)
        dataCallback("\n");
      }

      const result = await promptPromise;

      expect(result).toBe("ab"); // 'c' was deleted
      // Should write backspace sequence
      expect(mockStdout.write).toHaveBeenCalledWith("\b \b");
    });

    it("should handle carriage return as enter", async () => {
      let dataCallback: ((char: string) => void) | null = null;

      const ttyStdin = {
        isTTY: true,
        setRawMode: jest.fn(),
        resume: jest.fn(),
        pause: jest.fn(),
        setEncoding: jest.fn(),
        on: jest.fn((event: string, cb: (char: string) => void) => {
          if (event === "data") {
            dataCallback = cb;
          }
        }),
        removeListener: jest.fn(),
      };

      Object.defineProperty(process, "stdin", {
        value: ttyStdin,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(process, "stdout", {
        value: mockStdout,
        writable: true,
        configurable: true,
      });

      const { promptSecretValue } = await import("../../../src/utils/stdin.js");

      const promptPromise = promptSecretValue();

      await new Promise((resolve) => setTimeout(resolve, 10));

      if (dataCallback) {
        dataCallback("t");
        dataCallback("e");
        dataCallback("s");
        dataCallback("t");
        dataCallback("\r"); // Carriage return
      }

      const result = await promptPromise;

      expect(result).toBe("test");
    });

    it("should ignore non-printable characters except special keys", async () => {
      let dataCallback: ((char: string) => void) | null = null;

      const ttyStdin = {
        isTTY: true,
        setRawMode: jest.fn(),
        resume: jest.fn(),
        pause: jest.fn(),
        setEncoding: jest.fn(),
        on: jest.fn((event: string, cb: (char: string) => void) => {
          if (event === "data") {
            dataCallback = cb;
          }
        }),
        removeListener: jest.fn(),
      };

      Object.defineProperty(process, "stdin", {
        value: ttyStdin,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(process, "stdout", {
        value: mockStdout,
        writable: true,
        configurable: true,
      });

      const { promptSecretValue } = await import("../../../src/utils/stdin.js");

      const promptPromise = promptSecretValue();

      await new Promise((resolve) => setTimeout(resolve, 10));

      if (dataCallback) {
        dataCallback("a");
        dataCallback("\u0001"); // Control character (should be ignored)
        dataCallback("b");
        dataCallback("\n");
      }

      const result = await promptPromise;

      expect(result).toBe("ab");
    });
  });

  afterEach(() => {
    // Restore original stdin/stdout
    Object.defineProperty(process, "stdin", {
      value: originalStdin,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process, "stdout", {
      value: originalStdout,
      writable: true,
      configurable: true,
    });
  });
});

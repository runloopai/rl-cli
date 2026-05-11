/**
 * Tests for the PTY WebSocket connection helper.
 *
 * Focused on the retry classifier — the bit most likely to silently break
 * once people start poking at error message formatting.
 *
 * `ws` is mocked via `jest.unstable_mockModule`, which requires the module
 * under test to be loaded dynamically *after* the mock is registered. We do
 * this once in `beforeAll` and store the export at the top of the file so
 * individual tests can rely on plain references rather than scattered
 * `await import(...)` calls.
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { EventEmitter } from "events";

/**
 * Minimal fake `ws` that lets a test drive the connect lifecycle (open,
 * unexpected-response, error) without touching the network or real timers.
 */
class FakeWs extends EventEmitter {
  terminated = false;
  terminate() {
    this.terminated = true;
  }
  // Match the `ws` API surface the code under test touches.
  close() {}
}

const fakeWsInstances: FakeWs[] = [];
const wsConstructorMock = jest.fn(() => {
  const ws = new FakeWs();
  fakeWsInstances.push(ws);
  return ws;
});

jest.unstable_mockModule("ws", () => ({
  default: wsConstructorMock,
  __esModule: true,
}));

let openPtyWebSocket: typeof import("@/lib/pty-ws.js").openPtyWebSocket;

beforeAll(async () => {
  ({ openPtyWebSocket } = await import("@/lib/pty-ws.js"));
});

describe("openPtyWebSocket", () => {
  const originalRetries = process.env.RUNLOOP_PTY_WS_RETRIES;

  beforeEach(() => {
    fakeWsInstances.length = 0;
    wsConstructorMock.mockClear();
    process.env.RUNLOOP_PTY_WS_RETRIES = "3";
  });

  afterEach(() => {
    if (originalRetries === undefined) {
      delete process.env.RUNLOOP_PTY_WS_RETRIES;
    } else {
      process.env.RUNLOOP_PTY_WS_RETRIES = originalRetries;
    }
  });

  it("resolves on open", async () => {
    const promise = openPtyWebSocket("wss://h/p", undefined);

    // The constructor is called synchronously inside connectWebSocketOnce; emit
    // `open` on the next tick so the listener is in place.
    await new Promise((r) => setImmediate(r));
    fakeWsInstances[0].emit("open");

    const ws = await promise;
    expect(ws).toBe(fakeWsInstances[0]);
    expect(wsConstructorMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 502 and resolves on the second attempt", async () => {
    const promise = openPtyWebSocket("wss://h/p", "token");

    await new Promise((r) => setImmediate(r));
    fakeWsInstances[0].emit("unexpected-response", null, {
      statusCode: 502,
      statusMessage: "Bad Gateway",
    });

    // Back-off uses a real timer; allow up to ~1s for the first retry.
    for (let i = 0; i < 50 && fakeWsInstances.length < 2; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(fakeWsInstances).toHaveLength(2);

    fakeWsInstances[1].emit("open");
    const ws = await promise;
    expect(ws).toBe(fakeWsInstances[1]);
  });

  it("does not retry on 401", async () => {
    const promise = openPtyWebSocket("wss://h/p", "token");

    await new Promise((r) => setImmediate(r));
    fakeWsInstances[0].emit("unexpected-response", null, {
      statusCode: 401,
      statusMessage: "Unauthorized",
    });

    await expect(promise).rejects.toThrow(/401/);
    expect(fakeWsInstances).toHaveLength(1);
  });

  it("does not match 502 / 503 buried in unrelated error text", async () => {
    // Regression guard for the old loose `msg.includes("502")` fallback —
    // an unrelated message must not trigger a retry just because it contains
    // those digits.
    const promise = openPtyWebSocket("wss://h/p", undefined);

    await new Promise((r) => setImmediate(r));
    fakeWsInstances[0].emit(
      "error",
      new Error("ECONNRESET while reading 50234 bytes"),
    );

    await expect(promise).rejects.toThrow(/ECONNRESET/);
    expect(fakeWsInstances).toHaveLength(1);
  });

  it("passes the auth token via Sec-WebSocket-Protocol (not the URL)", async () => {
    const promise = openPtyWebSocket("wss://h/p", "secret-token");

    await new Promise((r) => setImmediate(r));
    expect(wsConstructorMock).toHaveBeenCalledWith("wss://h/p", [
      "secret-token",
    ]);

    fakeWsInstances[0].emit("open");
    await promise;
  });

  it("passes an empty protocols list when no token is provided", async () => {
    const promise = openPtyWebSocket("wss://h/p", undefined);

    await new Promise((r) => setImmediate(r));
    expect(wsConstructorMock).toHaveBeenCalledWith("wss://h/p", []);

    fakeWsInstances[0].emit("open");
    await promise;
  });
});

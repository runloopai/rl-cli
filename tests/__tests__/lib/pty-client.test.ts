/**
 * Tests for PTY client helpers.
 *
 * Focused on the pure helpers (URL builders, attach-mode toggle, releaser
 * once-only semantics) and the bootstrap retry classifier — i.e. the things
 * a future regression is most likely to silently break.
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import {
  buildWsUrl,
  buildPtyAttachPath,
  isPtyAttachOnlyMode,
  resolvePtyWebSocketUrl,
  createPtySessionReleaser,
  ptyConnect,
} from "@/lib/pty-client.js";

describe("buildWsUrl", () => {
  it("rewrites https:// to wss:// and keeps the host", () => {
    expect(buildWsUrl("https://13-abc.tunnel.example.com", "/pty/foo")).toBe(
      "wss://13-abc.tunnel.example.com/pty/foo",
    );
  });

  it("rewrites http:// to ws:// for local dev", () => {
    expect(buildWsUrl("http://localhost:5000", "/pty/foo/attach")).toBe(
      "ws://localhost:5000/pty/foo/attach",
    );
  });

  it("preserves port and ignores baseUrl path", () => {
    expect(buildWsUrl("https://api.example.com:8443/v1", "/pty/x")).toBe(
      "wss://api.example.com:8443/pty/x",
    );
  });
});

describe("buildPtyAttachPath", () => {
  it("URL-encodes session names with special characters", () => {
    expect(buildPtyAttachPath("session/with spaces & symbols")).toBe(
      "/pty/session%2Fwith%20spaces%20%26%20symbols/attach",
    );
  });

  it("omits the query string when no cols/rows provided", () => {
    expect(buildPtyAttachPath("s")).toBe("/pty/s/attach");
  });

  it("includes cols/rows when set", () => {
    expect(buildPtyAttachPath("s", 120, 40)).toBe(
      "/pty/s/attach?cols=120&rows=40",
    );
  });

  it("drops zero cols/rows (treated as 'unset')", () => {
    // Mirrors the URLSearchParams `if (cols)` filtering — zero cols isn't a
    // real terminal size, so emitting `cols=0` would be misleading.
    expect(buildPtyAttachPath("s", 0, 0)).toBe("/pty/s/attach");
  });
});

describe("isPtyAttachOnlyMode", () => {
  const originalEnv = process.env.RUNLOOP_PTY_ATTACH_ONLY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RUNLOOP_PTY_ATTACH_ONLY;
    } else {
      process.env.RUNLOOP_PTY_ATTACH_ONLY = originalEnv;
    }
  });

  it.each([
    ["1", true],
    ["true", true],
    ["TRUE", true],
    ["yes", true],
    ["0", false],
    ["false", false],
    ["", false],
  ])("env=%s → %s", (value, expected) => {
    process.env.RUNLOOP_PTY_ATTACH_ONLY = value;
    expect(isPtyAttachOnlyMode()).toBe(expected);
  });
});

describe("resolvePtyWebSocketUrl", () => {
  const originalFetch = globalThis.fetch;
  const originalAttachOnly = process.env.RUNLOOP_PTY_ATTACH_ONLY;
  const mockFetch = jest.fn<typeof globalThis.fetch>();

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
    delete process.env.RUNLOOP_PTY_ATTACH_ONLY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalAttachOnly === undefined) {
      delete process.env.RUNLOOP_PTY_ATTACH_ONLY;
    } else {
      process.env.RUNLOOP_PTY_ATTACH_ONLY = originalAttachOnly;
    }
  });

  it("returns the bootstrap connect_url converted to wss when attach-only is off", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session_name: "s",
        status: "ready",
        protocol_version: "1",
        connect_url: "/pty/s/attach?token=ephemeral",
        created: true,
        attached: false,
        cols: 80,
        rows: 24,
        idle_ttl_seconds: 300,
      }),
    } as Response);

    const url = await resolvePtyWebSocketUrl(
      "https://13-abc.tunnel.example.com",
      "s",
      { cols: 80, rows: 24 },
    );
    expect(url).toBe(
      "wss://13-abc.tunnel.example.com/pty/s/attach?token=ephemeral",
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("skips bootstrap and builds attach URL directly when attach-only is set", async () => {
    process.env.RUNLOOP_PTY_ATTACH_ONLY = "1";
    const url = await resolvePtyWebSocketUrl(
      "https://13-abc.tunnel.example.com",
      "s",
      { cols: 100, rows: 30 },
    );
    expect(url).toBe(
      "wss://13-abc.tunnel.example.com/pty/s/attach?cols=100&rows=30",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("createPtySessionReleaser", () => {
  const originalFetch = globalThis.fetch;
  const mockFetch = jest.fn<typeof globalThis.fetch>();

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ session_name: "s", status: "closed" }),
    } as Response);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("only triggers the underlying close call once across many releases", async () => {
    const release = createPtySessionReleaser(
      "https://h.example.com",
      "session-a",
      "tok",
    );
    release();
    release();
    release();
    // Releaser fires `ptyNotifyClosed` asynchronously (void-thened); give it a tick.
    await new Promise((r) => setImmediate(r));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://h.example.com/pty/session-a/control");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ action: "close" });
    expect(
      (init?.headers as Record<string, string>)["Authorization"],
    ).toBe("Bearer tok");
  });

  it("does not propagate ptyControl failures to the caller", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "boom",
      text: async () => "internal",
    } as Response);

    const release = createPtySessionReleaser("https://h.example.com", "s");
    expect(() => release()).not.toThrow();
    await new Promise((r) => setImmediate(r));
  });
});

describe("ptyConnect retry classifier", () => {
  const originalFetch = globalThis.fetch;
  const mockFetch = jest.fn<typeof globalThis.fetch>();

  beforeEach(() => {
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("retries 502 then succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        text: async () => "edge",
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session_name: "s",
          status: "ready",
          protocol_version: "1",
          connect_url: "/pty/s/attach",
          created: true,
          attached: false,
          cols: 80,
          rows: 24,
          idle_ttl_seconds: 300,
        }),
      } as Response);

    const res = await ptyConnect("https://h.example.com", "s", {
      cols: 80,
      rows: 24,
    });
    expect(res.connect_url).toBe("/pty/s/attach");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry 401 / 404 etc.", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "missing token",
    } as Response);

    await expect(
      ptyConnect("https://h.example.com", "s", { cols: 80, rows: 24 }),
    ).rejects.toThrow(/401/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

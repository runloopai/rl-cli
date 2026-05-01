import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockListAxonEvents = jest.fn();
jest.unstable_mockModule("@/services/axonService.js", () => ({
  listAxonEvents: mockListAxonEvents,
}));

const mockOutput = jest.fn();
const mockOutputError = jest.fn();
const mockParseLimit = jest.fn();
jest.unstable_mockModule("@/utils/output.js", () => ({
  output: mockOutput,
  outputError: mockOutputError,
  parseLimit: mockParseLimit,
}));

const { listAxonEventsCommand } = await import("@/commands/axon/events.js");

describe("listAxonEventsCommand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (console.log as jest.Mock).mockClear();
    mockParseLimit.mockReturnValue(Infinity);
  });

  it("prints table with events", async () => {
    const events = [
      {
        sequence: 1,
        timestamp_ms: 1700000000000,
        origin: "api",
        source: "user",
        event_type: "create",
        payload: '{"key":"value"}',
      },
      {
        sequence: 2,
        timestamp_ms: 1700000001000,
        origin: "system",
        source: "agent",
        event_type: "update",
        payload: '{"data":"test"}',
      },
    ];
    mockListAxonEvents.mockResolvedValue({ events, hasMore: false });

    await listAxonEventsCommand("axn_1", {});

    const calls = (console.log as jest.Mock).mock.calls;
    const allOutput = calls.map((c: any[]) => String(c[0])).join("\n");
    expect(allOutput).toContain("2 events");
  });

  it("defaults to limit 50 when parseLimit returns Infinity", async () => {
    mockParseLimit.mockReturnValue(Infinity);
    mockListAxonEvents.mockResolvedValue({ events: [], hasMore: false });

    await listAxonEventsCommand("axn_1", {});

    expect(mockListAxonEvents).toHaveBeenCalledWith("axn_1", { limit: 50 });
  });

  it("uses explicit limit", async () => {
    mockParseLimit.mockReturnValue(10);
    mockListAxonEvents.mockResolvedValue({ events: [], hasMore: false });

    await listAxonEventsCommand("axn_1", { limit: "10" });

    expect(mockListAxonEvents).toHaveBeenCalledWith("axn_1", { limit: 10 });
  });

  it("prints 'No events found' for empty results", async () => {
    mockListAxonEvents.mockResolvedValue({ events: [], hasMore: false });

    await listAxonEventsCommand("axn_1", {});

    const calls = (console.log as jest.Mock).mock.calls;
    const allOutput = calls.map((c: any[]) => String(c[0])).join("\n");
    expect(allOutput).toContain("No events found");
  });

  it("shows pagination hint when hasMore is true", async () => {
    const events = [
      {
        sequence: 1,
        timestamp_ms: 1700000000000,
        origin: "api",
        source: "user",
        event_type: "create",
        payload: "{}",
      },
    ];
    mockListAxonEvents.mockResolvedValue({ events, hasMore: true });

    await listAxonEventsCommand("axn_1", {});

    const calls = (console.log as jest.Mock).mock.calls;
    const allOutput = calls.map((c: any[]) => String(c[0])).join("\n");
    expect(allOutput).toContain("More events available");
  });

  it("does not show pagination hint when hasMore is false", async () => {
    const events = [
      {
        sequence: 1,
        timestamp_ms: 1700000000000,
        origin: "api",
        source: "user",
        event_type: "create",
        payload: "{}",
      },
    ];
    mockListAxonEvents.mockResolvedValue({ events, hasMore: false });

    await listAxonEventsCommand("axn_1", {});

    const calls = (console.log as jest.Mock).mock.calls;
    const allOutput = calls.map((c: any[]) => String(c[0])).join("\n");
    expect(allOutput).not.toContain("More events available");
  });

  it("uses output() for JSON format", async () => {
    const events = [{ sequence: 1, timestamp_ms: 1700000000000, origin: "api", source: "user", event_type: "create", payload: "{}" }];
    mockListAxonEvents.mockResolvedValue({ events, hasMore: false });

    await listAxonEventsCommand("axn_1", { output: "json" });

    expect(mockOutput).toHaveBeenCalledWith(events, {
      format: "json",
      defaultFormat: "json",
    });
    // Should not print table
    expect(console.log).not.toHaveBeenCalled();
  });

  it("uses output() for YAML format", async () => {
    const events = [{ sequence: 1, timestamp_ms: 1700000000000, origin: "api", source: "user", event_type: "create", payload: "{}" }];
    mockListAxonEvents.mockResolvedValue({ events, hasMore: false });

    await listAxonEventsCommand("axn_1", { output: "yaml" });

    expect(mockOutput).toHaveBeenCalledWith(events, {
      format: "yaml",
      defaultFormat: "json",
    });
  });

  it("does not use output() for text format", async () => {
    mockListAxonEvents.mockResolvedValue({ events: [], hasMore: false });

    await listAxonEventsCommand("axn_1", { output: "text" });

    expect(mockOutput).not.toHaveBeenCalled();
  });

  it("truncates payload to 60 chars", async () => {
    const longPayload = "A".repeat(80);
    const events = [
      {
        sequence: 1,
        timestamp_ms: 1700000000000,
        origin: "api",
        source: "user",
        event_type: "create",
        payload: longPayload,
      },
    ];
    mockListAxonEvents.mockResolvedValue({ events, hasMore: false });

    await listAxonEventsCommand("axn_1", {});

    const calls = (console.log as jest.Mock).mock.calls;
    // Data row is the 3rd call (after header and separator)
    const dataRow = String(calls[2][0]);
    expect(dataRow).not.toContain(longPayload);
    expect(dataRow).toContain("…");
  });

  it("truncates long origin with ellipsis", async () => {
    const events = [
      {
        sequence: 1,
        timestamp_ms: 1700000000000,
        origin: "a-very-long-origin-name",
        source: "user",
        event_type: "create",
        payload: "{}",
      },
    ];
    mockListAxonEvents.mockResolvedValue({ events, hasMore: false });

    await listAxonEventsCommand("axn_1", {});

    const dataRow = String((console.log as jest.Mock).mock.calls[2][0]);
    expect(dataRow).toContain("…");
  });

  it("shows singular 'event' for single result", async () => {
    const events = [
      {
        sequence: 1,
        timestamp_ms: 1700000000000,
        origin: "api",
        source: "user",
        event_type: "create",
        payload: "{}",
      },
    ];
    mockListAxonEvents.mockResolvedValue({ events, hasMore: false });

    await listAxonEventsCommand("axn_1", {});

    const calls = (console.log as jest.Mock).mock.calls;
    const allOutput = calls.map((c: any[]) => String(c[0])).join("\n");
    expect(allOutput).toContain("1 event");
    expect(allOutput).not.toContain("1 events");
  });

  it("handles API error gracefully", async () => {
    const error = new Error("Network error");
    mockListAxonEvents.mockRejectedValue(error);

    await listAxonEventsCommand("axn_1", {});

    expect(mockOutputError).toHaveBeenCalledWith(
      "Failed to get axon events",
      error,
    );
  });
});

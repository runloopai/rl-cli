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
    mockParseLimit.mockReturnValue(Infinity);
  });

  it("outputs events via output() with defaultFormat json", async () => {
    const events = [
      {
        sequence: 1,
        timestamp_ms: 1700000000000,
        origin: "api",
        source: "user",
        event_type: "create",
        payload: '{"key":"value"}',
      },
    ];
    mockListAxonEvents.mockResolvedValue({ events, hasMore: false });

    await listAxonEventsCommand("axn_1", {});

    expect(mockOutput).toHaveBeenCalledWith(events, {
      format: undefined,
      defaultFormat: "json",
    });
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

  it("passes format option through to output()", async () => {
    const events = [{ sequence: 1, timestamp_ms: 1700000000000, origin: "api", source: "user", event_type: "create", payload: "{}" }];
    mockListAxonEvents.mockResolvedValue({ events, hasMore: false });

    await listAxonEventsCommand("axn_1", { output: "yaml" });

    expect(mockOutput).toHaveBeenCalledWith(events, {
      format: "yaml",
      defaultFormat: "json",
    });
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

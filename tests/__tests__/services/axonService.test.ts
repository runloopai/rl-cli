import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockList = jest.fn();
const mockRetrieve = jest.fn();
const mockSqlQuery = jest.fn();

jest.unstable_mockModule("@/utils/client.js", () => ({
  getClient: () => ({
    axons: {
      list: mockList,
      retrieve: mockRetrieve,
      sql: { query: mockSqlQuery },
    },
  }),
}));

const { listActiveAxons, getAxon, listAxonEvents, executeAxonSql } =
  await import("@/services/axonService.js");

describe("listActiveAxons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes limit, startingAfter, includeTotalCount", async () => {
    mockList.mockResolvedValue({ axons: [], has_more: false });

    await listActiveAxons({
      limit: 10,
      startingAfter: "axn_cursor",
      includeTotalCount: true,
    });

    expect(mockList).toHaveBeenCalledWith({
      limit: 10,
      starting_after: "axn_cursor",
      include_total_count: true,
    });
  });

  it("smart search: axn_ prefix sets query.id", async () => {
    mockList.mockResolvedValue({ axons: [], has_more: false });

    await listActiveAxons({ search: "axn_123" });

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ id: "axn_123" }),
    );
  });

  it("smart search: non-axn_ sets query.name", async () => {
    mockList.mockResolvedValue({ axons: [], has_more: false });

    await listActiveAxons({ search: "my-axon" });

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ name: "my-axon" }),
    );
  });

  it("explicit name/id override search", async () => {
    mockList.mockResolvedValue({ axons: [], has_more: false });

    await listActiveAxons({ search: "my-axon", name: "override", id: "axn_override" });

    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ name: "override", id: "axn_override" }),
    );
  });

  it("returns axons, hasMore, totalCount", async () => {
    mockList.mockResolvedValue({
      axons: [{ id: "axn_1" }],
      has_more: true,
      total_count: 42,
    });

    const result = await listActiveAxons({ limit: 10 });
    expect(result.axons).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.totalCount).toBe(42);
  });

  it("totalCount defaults to axons.length when absent", async () => {
    mockList.mockResolvedValue({
      axons: [{ id: "axn_1" }, { id: "axn_2" }],
      has_more: false,
    });

    const result = await listActiveAxons({});
    expect(result.totalCount).toBe(2);
  });

  it("calls list with undefined when no query options", async () => {
    mockList.mockResolvedValue({ axons: [], has_more: false });

    await listActiveAxons({});

    expect(mockList).toHaveBeenCalledWith(undefined);
  });
});

describe("getAxon", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retrieves by id", async () => {
    const mockAxon = { id: "axn_1", name: "test-axon" };
    mockRetrieve.mockResolvedValue(mockAxon);

    const result = await getAxon("axn_1");
    expect(result).toEqual(mockAxon);
    expect(mockRetrieve).toHaveBeenCalledWith("axn_1");
  });
});

describe("listAxonEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls sql.query with correct SQL and params [limit+1, offset]", async () => {
    mockSqlQuery.mockResolvedValue({
      rows: [],
      meta: { duration_ms: 10, changes: 0 },
    });

    await listAxonEvents("axn_1", { limit: 20, offset: 5 });

    expect(mockSqlQuery).toHaveBeenCalledWith("axn_1", {
      sql: expect.stringContaining("rl_axon_events"),
      params: [21, 5],
    });
  });

  it("uses default limit=50, offset=0", async () => {
    mockSqlQuery.mockResolvedValue({
      rows: [],
      meta: { duration_ms: 10, changes: 0 },
    });

    await listAxonEvents("axn_1");

    expect(mockSqlQuery).toHaveBeenCalledWith("axn_1", {
      sql: expect.any(String),
      params: [51, 0],
    });
  });

  it("hasMore=true when rows > limit, slices to limit", async () => {
    const rows = Array.from({ length: 6 }, (_, i) => [
      i, 1700000000000, "origin", "source", "event", "payload",
    ]);
    mockSqlQuery.mockResolvedValue({
      rows,
      meta: { duration_ms: 10, changes: 0 },
    });

    const result = await listAxonEvents("axn_1", { limit: 5 });
    expect(result.hasMore).toBe(true);
    expect(result.events).toHaveLength(5);
  });

  it("hasMore=false when rows <= limit", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => [
      i, 1700000000000, "origin", "source", "event", "payload",
    ]);
    mockSqlQuery.mockResolvedValue({
      rows,
      meta: { duration_ms: 10, changes: 0 },
    });

    const result = await listAxonEvents("axn_1", { limit: 5 });
    expect(result.hasMore).toBe(false);
    expect(result.events).toHaveLength(3);
  });

  it("maps row arrays to AxonEvent objects", async () => {
    mockSqlQuery.mockResolvedValue({
      rows: [[42, 1700000000000, "my-origin", "my-source", "my-type", '{"data":1}']],
      meta: { duration_ms: 5, changes: 0 },
    });

    const result = await listAxonEvents("axn_1", { limit: 10 });
    expect(result.events[0]).toEqual({
      sequence: 42,
      timestamp_ms: 1700000000000,
      origin: "my-origin",
      source: "my-source",
      event_type: "my-type",
      payload: '{"data":1}',
    });
  });
});

describe("executeAxonSql", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls client.axons.sql.query with axonId, sql, params", async () => {
    const mockResult = { rows: [], columns: [], meta: { duration_ms: 0, changes: 0 } };
    mockSqlQuery.mockResolvedValue(mockResult);

    const result = await executeAxonSql("axn_1", "SELECT 1", []);
    expect(mockSqlQuery).toHaveBeenCalledWith("axn_1", { sql: "SELECT 1", params: [] });
    expect(result).toEqual(mockResult);
  });

  it("passes undefined params when not provided", async () => {
    mockSqlQuery.mockResolvedValue({ rows: [], columns: [], meta: {} });

    await executeAxonSql("axn_1", "SELECT 1");
    expect(mockSqlQuery).toHaveBeenCalledWith("axn_1", {
      sql: "SELECT 1",
      params: undefined,
    });
  });
});

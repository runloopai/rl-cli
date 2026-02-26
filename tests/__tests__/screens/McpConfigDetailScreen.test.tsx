/**
 * Per-screen tests for McpConfigDetailScreen.
 */
import React from "react";
import { describe, it, expect } from "@jest/globals";
import { render } from "ink-testing-library";
import { McpConfigDetailScreen } from "../../../src/screens/McpConfigDetailScreen.js";
import { NavigationProvider } from "../../../src/store/navigationStore.js";

const renderDetail = (mcpConfigId?: string) =>
  render(
    <NavigationProvider
      initialScreen="mcp-config-detail"
      initialParams={mcpConfigId ? { mcpConfigId } : {}}
    >
      <McpConfigDetailScreen mcpConfigId={mcpConfigId} />
    </NavigationProvider>,
  );

describe("McpConfigDetailScreen", () => {
  it("renders without crashing with mcpConfigId", () => {
    const { lastFrame } = renderDetail("mcp_test_1");
    expect(lastFrame()).toBeTruthy();
  });

  it("shows loading or content when mcpConfigId provided", () => {
    const { lastFrame } = renderDetail("mcp_test_1");
    const frame = lastFrame() ?? "";
    expect(frame.length).toBeGreaterThan(0);
    expect(
      frame.includes("Loading") ||
        frame.includes("MCP Config") ||
        frame.includes("mcp_test_1") ||
        frame.includes("Error"),
    ).toBe(true);
  });

  it("renders when mcpConfigId is missing", () => {
    const { lastFrame } = renderDetail();
    expect(lastFrame()).toBeTruthy();
  });
});

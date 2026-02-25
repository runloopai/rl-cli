/**
 * Per-screen tests for BlueprintDetailScreen.
 */
import React from "react";
import { describe, it, expect } from "@jest/globals";
import { render } from "ink-testing-library";
import { BlueprintDetailScreen } from "../../../src/screens/BlueprintDetailScreen.js";
import { NavigationProvider } from "../../../src/store/navigationStore.js";

const renderDetail = (blueprintId?: string) =>
  render(
    <NavigationProvider
      initialScreen="blueprint-detail"
      initialParams={blueprintId ? { blueprintId } : {}}
    >
      <BlueprintDetailScreen blueprintId={blueprintId} />
    </NavigationProvider>,
  );

describe("BlueprintDetailScreen", () => {
  it("renders without crashing with blueprintId", () => {
    const { lastFrame } = renderDetail("bpt_test_1");
    expect(lastFrame()).toBeTruthy();
  });

  it("shows loading or content when blueprintId provided", () => {
    const { lastFrame } = renderDetail("bpt_test_1");
    const frame = lastFrame() ?? "";
    expect(frame.length).toBeGreaterThan(0);
    expect(
      frame.includes("Loading") ||
        frame.includes("Blueprint") ||
        frame.includes("bpt_test_1") ||
        frame.includes("Error"),
    ).toBe(true);
  });

  it("renders when blueprintId is missing", () => {
    const { lastFrame } = renderDetail();
    expect(lastFrame()).toBeTruthy();
  });
});

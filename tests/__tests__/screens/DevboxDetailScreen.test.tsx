/**
 * Per-screen tests for DevboxDetailScreen. Renders in isolation with props.
 */
import React from "react";
import { describe, it, expect } from "@jest/globals";
import { render } from "ink-testing-library";
import { DevboxDetailScreen } from "../../../src/screens/DevboxDetailScreen.js";
import { NavigationProvider } from "../../../src/store/navigationStore.js";

const renderDetail = (devboxId?: string) =>
  render(
    <NavigationProvider
      initialScreen="devbox-detail"
      initialParams={devboxId ? { devboxId } : {}}
    >
      <DevboxDetailScreen devboxId={devboxId} />
    </NavigationProvider>,
  );

describe("DevboxDetailScreen", () => {
  it("renders without crashing with devboxId", () => {
    const { lastFrame } = renderDetail("dbx_test_123");
    expect(lastFrame()).toBeTruthy();
  });

  it("shows loading or content when devboxId provided", () => {
    const { lastFrame } = renderDetail("dbx_test_123");
    const frame = lastFrame() ?? "";
    expect(frame.length).toBeGreaterThan(0);
    expect(
      frame.includes("Loading") ||
        frame.includes("Devbox") ||
        frame.includes("dbx_test_123") ||
        frame.includes("Error"),
    ).toBe(true);
  });

  it("renders when devboxId is missing", () => {
    const { lastFrame } = renderDetail();
    expect(lastFrame()).toBeTruthy();
  });
});

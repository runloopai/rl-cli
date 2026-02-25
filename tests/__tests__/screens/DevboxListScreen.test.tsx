/**
 * Per-screen tests for DevboxListScreen.
 */
import React from "react";
import { describe, it, expect } from "@jest/globals";
import { render } from "ink-testing-library";
import { DevboxListScreen } from "../../../src/screens/DevboxListScreen.js";
import { NavigationProvider } from "../../../src/store/navigationStore.js";

const renderDevboxList = (props: { status?: string; focusDevboxId?: string } = {}) =>
  render(
    <NavigationProvider initialScreen="devbox-list">
      <DevboxListScreen {...props} />
    </NavigationProvider>,
  );

describe("DevboxListScreen", () => {
  it("renders without crashing", () => {
    const { lastFrame } = renderDevboxList();
    expect(lastFrame()).toBeTruthy();
  });

  it("shows list or loading state", () => {
    const { lastFrame } = renderDevboxList();
    const frame = lastFrame() ?? "";
    expect(frame.length).toBeGreaterThan(0);
    expect(
      frame.includes("Devbox") ||
        frame.includes("Loading") ||
        frame.includes("devbox") ||
        frame.includes("rl"),
    ).toBe(true);
  });
});

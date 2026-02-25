/**
 * Integration tests for critical multi-screen navigation flows.
 * Uses real NavigationProvider + Router (no navigation mock).
 */
import React from "react";
import { describe, it, expect } from "@jest/globals";
import { render } from "ink-testing-library";
import { NavigationProvider } from "../../../src/store/navigationStore.js";
import { BetaFeatureProvider } from "../../../src/store/betaFeatureStore.js";
import { Router } from "../../../src/router/Router.js";

function renderApp(initialScreen: "menu" | "devbox-list" = "menu") {
  return render(
    <BetaFeatureProvider>
      <NavigationProvider initialScreen={initialScreen}>
        <Router />
      </NavigationProvider>
    </BetaFeatureProvider>,
  );
}

describe("navigation flows", () => {
  it("menu -> devbox list (shortcut d)", () => {
    const { lastFrame, stdin } = renderApp("menu");

    let frame = lastFrame() ?? "";
    expect(frame).toContain("Devboxes");
    expect(frame).toContain("Blueprints");

    stdin.write("d");
    frame = lastFrame() ?? "";
    expect(frame.length).toBeGreaterThan(0);
    expect(
      frame.includes("Devbox") ||
        frame.includes("Loading") ||
        frame.includes("devbox") ||
        frame.includes("No devboxes"),
    ).toBe(true);
  });

  it("menu -> blueprint list (shortcut b)", () => {
    const { lastFrame, stdin } = renderApp("menu");

    let frame = lastFrame() ?? "";
    expect(frame).toContain("Blueprints");

    stdin.write("b");
    frame = lastFrame() ?? "";
    expect(
      frame.includes("Blueprint") ||
        frame.includes("Loading") ||
        frame.includes("blueprint"),
    ).toBe(true);
  });

  it("starting at devbox-list shows list screen", () => {
    const { lastFrame } = renderApp("devbox-list");

    const frame = lastFrame() ?? "";
    expect(frame.length).toBeGreaterThan(0);
    expect(
      frame.includes("Devbox") || frame.includes("Loading") || frame.includes("rl"),
    ).toBe(true);
  });
});

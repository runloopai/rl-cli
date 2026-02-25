/**
 * Router wiring tests: given a navigation state, Router renders the correct screen.
 * Uses real NavigationProvider (no navigation mock) via jest.router.config.js.
 */
import React from "react";
import { describe, it, expect } from "@jest/globals";
import { render } from "ink-testing-library";
import { NavigationProvider } from "../../../src/store/navigationStore.js";
import { BetaFeatureProvider } from "../../../src/store/betaFeatureStore.js";
import { Router } from "../../../src/router/Router.js";

function renderWithApp(
  initialScreen: "menu" | "devbox-list" | "devbox-detail" | "blueprint-list" | "blueprint-detail" | "secret-list" | string,
  initialParams: Record<string, string> = {},
) {
  return render(
    <BetaFeatureProvider>
      <NavigationProvider initialScreen={initialScreen} initialParams={initialParams}>
        <Router />
      </NavigationProvider>
    </BetaFeatureProvider>,
  );
}

describe("Router", () => {
  it("renders menu screen when initialScreen is menu", () => {
    const { lastFrame } = renderWithApp("menu");
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Devboxes");
    expect(frame).toContain("Blueprints");
  });

  it("renders devbox-list screen when initialScreen is devbox-list", () => {
    const { lastFrame } = renderWithApp("devbox-list");
    const frame = lastFrame() ?? "";
    // List screen shows title or loading/empty state
    expect(frame.length).toBeGreaterThan(0);
    expect(
      frame.includes("Devbox") || frame.includes("Loading") || frame.includes("devbox"),
    ).toBe(true);
  });

  it("renders devbox-detail screen when initialScreen is devbox-detail with params", () => {
    const { lastFrame } = renderWithApp("devbox-detail", { devboxId: "dbx_test_123" });
    const frame = lastFrame() ?? "";
    // Detail screen shows id, loading, or error
    expect(frame.length).toBeGreaterThan(0);
    expect(
      frame.includes("dbx_test_123") ||
        frame.includes("Loading") ||
        frame.includes("Devbox") ||
        frame.includes("Error"),
    ).toBe(true);
  });

  it("renders blueprint-list screen when initialScreen is blueprint-list", () => {
    const { lastFrame } = renderWithApp("blueprint-list");
    const frame = lastFrame() ?? "";
    expect(frame.length).toBeGreaterThan(0);
    expect(
      frame.includes("Blueprint") || frame.includes("Loading") || frame.includes("blueprint"),
    ).toBe(true);
  });

  it("renders blueprint-detail screen when initialScreen is blueprint-detail with params", () => {
    const { lastFrame } = renderWithApp("blueprint-detail", { blueprintId: "bpt_test_1" });
    const frame = lastFrame() ?? "";
    expect(frame.length).toBeGreaterThan(0);
    expect(
      frame.includes("bpt_test_1") ||
        frame.includes("Blueprint") ||
        frame.includes("Loading") ||
        frame.includes("Error"),
    ).toBe(true);
  });

  it("renders secret-list screen when initialScreen is secret-list", () => {
    const { lastFrame } = renderWithApp("secret-list");
    const frame = lastFrame() ?? "";
    expect(frame.length).toBeGreaterThan(0);
    expect(
      frame.includes("Secret") || frame.includes("Loading") || frame.includes("secret"),
    ).toBe(true);
  });

  it("renders UnknownScreen for unknown screen name", () => {
    const { lastFrame } = renderWithApp("invalid-screen-name" as "menu");
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Unknown Page");
    expect(frame).toContain("invalid-screen-name");
  });
});

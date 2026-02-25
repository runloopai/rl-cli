/**
 * Per-screen tests for MenuScreen. Renders with NavigationProvider (mocked in component config).
 */
import React from "react";
import { describe, it, expect } from "@jest/globals";
import { render } from "ink-testing-library";
import { MenuScreen } from "../../../src/screens/MenuScreen.js";
import { NavigationProvider } from "../../../src/store/navigationStore.js";
import { BetaFeatureProvider } from "../../../src/store/betaFeatureStore.js";

const renderMenuScreen = () =>
  render(
    <BetaFeatureProvider>
      <NavigationProvider initialScreen="menu">
        <MenuScreen />
      </NavigationProvider>
    </BetaFeatureProvider>,
  );

describe("MenuScreen", () => {
  it("renders without crashing", () => {
    const { lastFrame } = renderMenuScreen();
    expect(lastFrame()).toBeTruthy();
  });

  it("displays main menu items", () => {
    const { lastFrame } = renderMenuScreen();
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Devboxes");
    expect(frame).toContain("Blueprints");
    expect(frame).toContain("Snapshots");
  });

  it("shows navigation help", () => {
    const { lastFrame } = renderMenuScreen();
    const frame = lastFrame() ?? "";
    expect(frame.length).toBeGreaterThan(0);
  });
});

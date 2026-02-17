/**
 * Tests for MainMenu component
 */
import React from "react";
import { render } from "ink-testing-library";
import { MainMenu } from "../../../src/components/MainMenu.js";
import { BetaFeatureProvider } from "../../../src/store/betaFeatureStore.js";

// Helper to render MainMenu with required providers
const renderMainMenu = (onSelect = () => {}) => {
  return render(
    <BetaFeatureProvider>
      <MainMenu onSelect={onSelect} />
    </BetaFeatureProvider>,
  );
};

describe("MainMenu", () => {
  it("renders without crashing", () => {
    const { lastFrame } = renderMainMenu();
    expect(lastFrame()).toBeTruthy();
  });

  it("displays menu items", () => {
    const { lastFrame } = renderMainMenu();

    const frame = lastFrame() || "";
    expect(frame).toContain("Devboxes");
    expect(frame).toContain("Blueprints");
    expect(frame).toContain("Snapshots");
  });

  it("shows menu item descriptions", () => {
    const { lastFrame } = renderMainMenu();

    const frame = lastFrame() || "";
    expect(frame).toContain("development environments");
    expect(frame).toContain("templates");
    expect(frame).toContain("devbox states");
  });

  it("shows keyboard shortcuts", () => {
    const { lastFrame } = renderMainMenu();

    const frame = lastFrame() || "";
    expect(frame).toContain("[1]");
    expect(frame).toContain("[2]");
    expect(frame).toContain("[3]");
  });

  it("shows navigation help", () => {
    const { lastFrame } = renderMainMenu();

    const frame = lastFrame() || "";
    expect(frame).toContain("Navigate");
    expect(frame).toContain("Quick select");
    expect(frame).toContain("Select");
    expect(frame).toContain("Quit");
  });

  it("displays version number", () => {
    const { lastFrame } = renderMainMenu();

    expect(lastFrame()).toContain("v");
  });

  it("shows RUNLOOP branding", () => {
    const { lastFrame } = renderMainMenu();

    // Either compact or full layout should show branding
    const frame = lastFrame() || "";
    expect(frame.includes("RUNLOOP") || frame.includes("rl")).toBe(true);
  });

  it("shows resource selection prompt", () => {
    const { lastFrame } = renderMainMenu();

    const frame = lastFrame() || "";
    // Should show "Select a resource:" or have a selection pointer
    expect(frame.includes("Select") || frame.includes("❯")).toBe(true);
  });
});

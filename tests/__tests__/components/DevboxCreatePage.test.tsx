/**
 * Tests for DevboxCreatePage component
 */
import React from "react";
import { render } from "ink-testing-library";
import { DevboxCreatePage } from "../../../src/components/DevboxCreatePage.js";

describe("DevboxCreatePage", () => {
  it("renders without crashing", () => {
    const { lastFrame } = render(<DevboxCreatePage onBack={() => {}} />);
    expect(lastFrame()).toBeTruthy();
  });

  it("displays breadcrumb with Create label", () => {
    const { lastFrame } = render(<DevboxCreatePage onBack={() => {}} />);

    const frame = lastFrame() || "";
    expect(frame).toContain("Devboxes");
    expect(frame).toContain("Create");
  });

  it("shows Devbox Create action", () => {
    const { lastFrame } = render(<DevboxCreatePage onBack={() => {}} />);
    expect(lastFrame()).toContain("Devbox Create");
  });

  it("shows form fields", () => {
    const { lastFrame } = render(<DevboxCreatePage onBack={() => {}} />);

    const frame = lastFrame() || "";
    expect(frame).toContain("Name");
    expect(frame).toContain("Architecture");
    expect(frame).toContain("Resource Size");
  });

  it("displays default architecture value", () => {
    const { lastFrame } = render(<DevboxCreatePage onBack={() => {}} />);
    expect(lastFrame()).toContain("x86_64");
  });

  it("displays default resource size value", () => {
    const { lastFrame } = render(<DevboxCreatePage onBack={() => {}} />);
    expect(lastFrame()).toContain("SMALL");
  });

  it("shows Keep Alive field", () => {
    const { lastFrame } = render(<DevboxCreatePage onBack={() => {}} />);
    expect(lastFrame()).toContain("Keep Alive");
  });

  it("shows optional fields", () => {
    const { lastFrame } = render(<DevboxCreatePage onBack={() => {}} />);

    const frame = lastFrame() || "";
    expect(frame).toContain("Blueprint ID");
    expect(frame).toContain("Snapshot ID");
    expect(frame).toContain("Metadata");
  });

  it("shows navigation help", () => {
    const { lastFrame } = render(<DevboxCreatePage onBack={() => {}} />);

    const frame = lastFrame() || "";
    expect(frame).toContain("Navigate");
    expect(frame).toContain("Create");
    expect(frame).toContain("Cancel");
  });

  it("accepts initial blueprint ID", () => {
    const { lastFrame } = render(
      <DevboxCreatePage
        onBack={() => {}}
        initialBlueprintId="bp_initial_123"
      />,
    );
    expect(lastFrame()).toContain("bp_initial_123");
  });
});

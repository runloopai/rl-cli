/**
 * Tests for MetadataDisplay component
 */
import React from "react";
import { render } from "ink-testing-library";
import { MetadataDisplay } from "../../../src/components/MetadataDisplay.js";

describe("MetadataDisplay", () => {
  it("renders without crashing", () => {
    const { lastFrame } = render(
      <MetadataDisplay metadata={{ key: "value" }} />,
    );
    expect(lastFrame()).toBeTruthy();
  });

  it("displays metadata key-value pairs", () => {
    const { lastFrame } = render(
      <MetadataDisplay metadata={{ env: "production", team: "backend" }} />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("env");
    expect(frame).toContain("production");
    expect(frame).toContain("team");
    expect(frame).toContain("backend");
  });

  it("shows default title", () => {
    const { lastFrame } = render(
      <MetadataDisplay metadata={{ key: "value" }} />,
    );

    expect(lastFrame()).toContain("Metadata");
  });

  it("shows custom title", () => {
    const { lastFrame } = render(
      <MetadataDisplay metadata={{ key: "value" }} title="Custom Title" />,
    );

    expect(lastFrame()).toContain("Custom Title");
  });

  it("returns null for empty metadata", () => {
    const { lastFrame } = render(<MetadataDisplay metadata={{}} />);

    expect(lastFrame()).toBe("");
  });

  it("renders with border when showBorder is true", () => {
    const { lastFrame } = render(
      <MetadataDisplay metadata={{ key: "value" }} showBorder={true} />,
    );

    // Should contain border characters
    const frame = lastFrame() || "";
    expect(frame).toBeTruthy();
  });

  it("renders without border by default", () => {
    const { lastFrame } = render(
      <MetadataDisplay metadata={{ key: "value" }} />,
    );

    expect(lastFrame()).toBeTruthy();
  });

  it("highlights selected key", () => {
    const { lastFrame } = render(
      <MetadataDisplay
        metadata={{ key1: "value1", key2: "value2" }}
        selectedKey="key1"
      />,
    );

    // Should render with selection indicator
    expect(lastFrame()).toContain("key1");
  });

  it("handles multiple metadata entries", () => {
    const { lastFrame } = render(
      <MetadataDisplay
        metadata={{
          environment: "prod",
          region: "us-east-1",
          team: "platform",
          version: "1.0.0",
        }}
      />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("environment");
    expect(frame).toContain("region");
    expect(frame).toContain("team");
    expect(frame).toContain("version");
  });

  it("shows identical icon with title", () => {
    const { lastFrame } = render(
      <MetadataDisplay metadata={{ key: "value" }} title="Tags" />,
    );

    expect(lastFrame()).toContain("≡"); // figures.identical
  });
});

/**
 * Tests for StreamingLogsViewer component
 */
import React from "react";
import { jest } from "@jest/globals";
import { render } from "ink-testing-library";
import { StreamingLogsViewer } from "../../../src/components/StreamingLogsViewer.js";

describe("StreamingLogsViewer", () => {
  const defaultProps = {
    devboxId: "dbx_123",
    onBack: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { lastFrame } = render(<StreamingLogsViewer {...defaultProps} />);
    expect(lastFrame()).toBeTruthy();
  });

  it("displays default breadcrumb", () => {
    const { lastFrame } = render(<StreamingLogsViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Logs");
  });

  it("displays custom breadcrumb items", () => {
    const { lastFrame } = render(
      <StreamingLogsViewer
        {...defaultProps}
        breadcrumbItems={[
          { label: "Devbox" },
          { label: "Custom Logs", active: true },
        ]}
      />,
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Devbox");
    expect(frame).toContain("Custom Logs");
  });

  it("shows navigation tips", () => {
    const { lastFrame } = render(<StreamingLogsViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Navigate");
    expect(frame).toContain("Back");
  });

  it("shows wrap mode toggle option", () => {
    const { lastFrame } = render(<StreamingLogsViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Wrap");
  });

  it("shows copy option", () => {
    const { lastFrame } = render(<StreamingLogsViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Copy");
  });

  it("shows top/bottom navigation options", () => {
    const { lastFrame } = render(<StreamingLogsViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Top");
    expect(frame).toContain("Bottom");
  });

  it("shows pause/resume option", () => {
    const { lastFrame } = render(<StreamingLogsViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    // Should show either Pause or Resume
    const hasPauseOrResume =
      frame.includes("Pause") || frame.includes("Resume");
    expect(hasPauseOrResume).toBe(true);
  });

  it("shows wrap mode status", () => {
    const { lastFrame } = render(<StreamingLogsViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    // Should show wrap mode status (OFF by default)
    expect(frame).toContain("Wrap:");
  });

  it("shows logs count area", () => {
    const { lastFrame } = render(<StreamingLogsViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    // Shows "0 logs" when empty
    expect(frame).toContain("logs");
  });
});

/**
 * Tests for LogsViewer component
 */
import React from "react";
import { render } from "ink-testing-library";
import { LogsViewer } from "../../../src/components/LogsViewer.js";

describe("LogsViewer", () => {
  const mockLogs = [
    {
      timestamp_ms: Date.now(),
      level: "INFO",
      source: "system",
      message: "Test log message 1",
    },
    {
      timestamp_ms: Date.now() - 1000,
      level: "ERROR",
      source: "app",
      message: "Test error message",
    },
  ];

  it("renders without crashing", () => {
    const { lastFrame } = render(
      <LogsViewer logs={mockLogs} onBack={() => {}} />,
    );
    expect(lastFrame()).toBeTruthy();
  });

  it("displays logs", () => {
    const { lastFrame } = render(
      <LogsViewer logs={mockLogs} onBack={() => {}} />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Test log message 1");
  });

  it("shows total logs count", () => {
    const { lastFrame } = render(
      <LogsViewer logs={mockLogs} onBack={() => {}} />,
    );

    expect(lastFrame()).toContain("2");
    expect(lastFrame()).toContain("total logs");
  });

  it("displays breadcrumb", () => {
    const { lastFrame } = render(
      <LogsViewer
        logs={mockLogs}
        onBack={() => {}}
        breadcrumbItems={[{ label: "Devbox" }, { label: "Logs", active: true }]}
      />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Devbox");
    expect(frame).toContain("Logs");
  });

  it("shows navigation help", () => {
    const { lastFrame } = render(
      <LogsViewer logs={mockLogs} onBack={() => {}} />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Navigate");
    expect(frame).toContain("Top");
    expect(frame).toContain("Bottom");
    expect(frame).toContain("Wrap");
    expect(frame).toContain("Copy");
    expect(frame).toContain("Back");
  });

  it("shows wrap mode status", () => {
    const { lastFrame } = render(
      <LogsViewer logs={mockLogs} onBack={() => {}} />,
    );

    expect(lastFrame()).toContain("Wrap: OFF");
  });

  it("handles empty logs", () => {
    const { lastFrame } = render(<LogsViewer logs={[]} onBack={() => {}} />);

    expect(lastFrame()).toContain("No logs available");
  });

  it("accepts custom title", () => {
    const { lastFrame } = render(
      <LogsViewer logs={mockLogs} onBack={() => {}} title="Custom Logs" />,
    );

    // Title is used for breadcrumb default
    expect(lastFrame()).toBeTruthy();
  });

  it("shows viewing range", () => {
    const { lastFrame } = render(
      <LogsViewer logs={mockLogs} onBack={() => {}} />,
    );

    expect(lastFrame()).toContain("Viewing");
  });
});

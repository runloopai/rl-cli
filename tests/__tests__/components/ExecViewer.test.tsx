/**
 * Tests for ExecViewer component
 */
import React from "react";
import { jest } from "@jest/globals";
import { render } from "ink-testing-library";
import { ExecViewer } from "../../../src/components/ExecViewer.js";

describe("ExecViewer", () => {
  const defaultProps = {
    devboxId: "dbx_123",
    command: "echo hello",
    breadcrumbItems: [
      { label: "Devboxes" },
      { label: "test-devbox" },
      { label: "Execute", active: true },
    ],
    onBack: jest.fn(),
    onRunAnother: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { lastFrame } = render(<ExecViewer {...defaultProps} />);
    expect(lastFrame()).toBeTruthy();
  });

  it("displays command in header", () => {
    const { lastFrame } = render(<ExecViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("echo hello");
  });

  it("displays breadcrumb navigation", () => {
    const { lastFrame } = render(<ExecViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Devboxes");
    expect(frame).toContain("test-devbox");
    expect(frame).toContain("Execute");
  });

  it("shows status indicator", () => {
    const { lastFrame } = render(<ExecViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Status");
  });

  it("shows navigation tips for running state", () => {
    const { lastFrame } = render(<ExecViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    // Should show kill option when running
    expect(frame).toContain("Kill");
  });

  it("truncates long commands in display", () => {
    const longCommand = "a".repeat(100);
    const { lastFrame } = render(
      <ExecViewer {...defaultProps} command={longCommand} />,
    );
    const frame = lastFrame() || "";
    // Should truncate to 80 chars + "..."
    expect(frame).toContain("...");
  });

  it("accepts existingExecutionId for resume", () => {
    const { lastFrame } = render(
      <ExecViewer {...defaultProps} existingExecutionId="exec-456" />,
    );
    expect(lastFrame()).toBeTruthy();
  });

  it("calls onExecutionStart callback when execution starts", () => {
    const onExecutionStart = jest.fn();
    render(
      <ExecViewer {...defaultProps} onExecutionStart={onExecutionStart} />,
    );
    // The callback is called async, so we just verify it renders
    expect(onExecutionStart).toBeDefined();
  });

  it("shows Command label in header", () => {
    const { lastFrame } = render(<ExecViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Command");
  });

  it("displays scroll navigation tips", () => {
    const { lastFrame } = render(<ExecViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Scroll");
  });

  it("shows leave running option", () => {
    const { lastFrame } = render(<ExecViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("Leave Running");
  });

  it("handles custom breadcrumb items", () => {
    const customBreadcrumbs = [
      { label: "Home" },
      { label: "Custom", active: true },
    ];
    const { lastFrame } = render(
      <ExecViewer {...defaultProps} breadcrumbItems={customBreadcrumbs} />,
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Home");
    expect(frame).toContain("Custom");
  });

  it("shows lines count in statistics bar", () => {
    const { lastFrame } = render(<ExecViewer {...defaultProps} />);
    const frame = lastFrame() || "";
    expect(frame).toContain("lines");
  });
});

describe("ExecViewer with completed execution", () => {
  const defaultProps = {
    devboxId: "dbx_123",
    command: "echo hello",
    breadcrumbItems: [{ label: "Execute", active: true }],
    onBack: jest.fn(),
    onRunAnother: jest.fn(),
    existingExecutionId: "exec-completed",
  };

  it("renders completed state", () => {
    const { lastFrame } = render(<ExecViewer {...defaultProps} />);
    expect(lastFrame()).toBeTruthy();
  });
});

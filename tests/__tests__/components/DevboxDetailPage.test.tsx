/**
 * Tests for DevboxDetailPage component
 */
import React from "react";
import { render } from "ink-testing-library";
import { DevboxDetailPage } from "../../../src/components/DevboxDetailPage.js";
import { NavigationProvider } from "../../../src/store/navigationStore.js";

const renderWithNav = (ui: React.ReactElement) =>
  render(<NavigationProvider>{ui}</NavigationProvider>);

describe("DevboxDetailPage", () => {
  const mockDevbox = {
    id: "dbx_test_123",
    name: "test-devbox",
    status: "running",
    create_time_ms: Date.now() - 3600000, // 1 hour ago
    capabilities: ["shell", "code"],
    launch_parameters: {
      architecture: "arm64",
      resource_size_request: "SMALL",
    },
  };

  it("renders without crashing", () => {
    const { lastFrame } = renderWithNav(
      <DevboxDetailPage devbox={mockDevbox} onBack={() => {}} />,
    );
    expect(lastFrame()).toBeTruthy();
  });

  it("displays devbox name", () => {
    const { lastFrame } = renderWithNav(
      <DevboxDetailPage devbox={mockDevbox} onBack={() => {}} />,
    );
    expect(lastFrame()).toContain("test-devbox");
  });

  it("displays devbox id", () => {
    const { lastFrame } = renderWithNav(
      <DevboxDetailPage devbox={mockDevbox} onBack={() => {}} />,
    );
    expect(lastFrame()).toContain("dbx_test_123");
  });

  it("shows status badge", () => {
    const { lastFrame } = renderWithNav(
      <DevboxDetailPage devbox={mockDevbox} onBack={() => {}} />,
    );
    expect(lastFrame()).toContain("Running");
  });

  it("shows Actions section", () => {
    const { lastFrame } = renderWithNav(
      <DevboxDetailPage devbox={mockDevbox} onBack={() => {}} />,
    );
    expect(lastFrame()).toContain("Actions");
  });

  it("shows available operations", () => {
    const { lastFrame } = renderWithNav(
      <DevboxDetailPage devbox={mockDevbox} onBack={() => {}} />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("View Logs");
    expect(frame).toContain("Execute Command");
  });

  it("shows navigation help", () => {
    const { lastFrame } = renderWithNav(
      <DevboxDetailPage devbox={mockDevbox} onBack={() => {}} />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Nav");
    expect(frame).toContain("Run");
    expect(frame).toContain("Back");
  });

  it("displays resource information", () => {
    const { lastFrame } = renderWithNav(
      <DevboxDetailPage devbox={mockDevbox} onBack={() => {}} />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Resources");
    expect(frame).toContain("SMALL");
    expect(frame).toContain("arm64");
  });

  it("displays capabilities", () => {
    const { lastFrame } = renderWithNav(
      <DevboxDetailPage devbox={mockDevbox} onBack={() => {}} />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Capabilities");
    expect(frame).toContain("shell");
    expect(frame).toContain("code");
  });
});

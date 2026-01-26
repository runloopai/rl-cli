/**
 * Tests for DevboxExecScreen component
 *
 * Note: These tests use the main setup.ts which mocks Ink components,
 * so we test that the component renders without errors rather than
 * specific rendered content.
 */
import React from "react";
import { render } from "ink-testing-library";
import { DevboxExecScreen } from "../../../src/screens/DevboxExecScreen.js";

describe("DevboxExecScreen", () => {
  it("renders without crashing with valid props", () => {
    const { lastFrame } = render(
      <DevboxExecScreen
        devboxId="dbx_123"
        execCommand="echo hello"
        devboxName="test-devbox"
      />,
    );
    expect(lastFrame()).toBeDefined();
  });

  it("renders when missing devboxId", () => {
    const { lastFrame } = render(
      <DevboxExecScreen execCommand="echo hello" devboxName="test-devbox" />,
    );
    // Should render error state
    expect(lastFrame()).toBeDefined();
  });

  it("renders when missing execCommand", () => {
    const { lastFrame } = render(
      <DevboxExecScreen devboxId="dbx_123" devboxName="test-devbox" />,
    );
    // Should render error state
    expect(lastFrame()).toBeDefined();
  });

  it("renders with all props", () => {
    const { lastFrame } = render(
      <DevboxExecScreen
        devboxId="dbx_123"
        execCommand="echo hello"
        devboxName="my-devbox"
      />,
    );
    expect(lastFrame()).toBeDefined();
  });

  it("handles executionId for resume", () => {
    const { lastFrame } = render(
      <DevboxExecScreen
        devboxId="dbx_123"
        execCommand="echo hello"
        devboxName="test-devbox"
        executionId="exec-456"
      />,
    );
    expect(lastFrame()).toBeDefined();
  });

  it("renders with devboxId only (no name)", () => {
    const { lastFrame } = render(
      <DevboxExecScreen devboxId="dbx_123" execCommand="echo hello" />,
    );
    expect(lastFrame()).toBeDefined();
  });
});

/**
 * Tests for SuccessMessage component
 */
import React from "react";
import { render } from "ink-testing-library";
import { SuccessMessage } from "../../../src/components/SuccessMessage.js";

describe("SuccessMessage", () => {
  it("renders without crashing", () => {
    const { lastFrame } = render(<SuccessMessage message="Success!" />);
    expect(lastFrame()).toBeTruthy();
  });

  it("displays the success message", () => {
    const { lastFrame } = render(
      <SuccessMessage message="Operation completed successfully" />,
    );
    expect(lastFrame()).toContain("Operation completed successfully");
  });

  it("shows tick icon", () => {
    const { lastFrame } = render(<SuccessMessage message="Done" />);
    expect(lastFrame()).toContain("✓");
  });

  it("displays details when provided", () => {
    const { lastFrame } = render(
      <SuccessMessage message="Created successfully" details="ID: test-123" />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Created successfully");
    expect(frame).toContain("ID: test-123");
  });

  it("handles multi-line details", () => {
    const { lastFrame } = render(
      <SuccessMessage message="Success" details="Line 1\nLine 2\nLine 3" />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Line 1");
    expect(frame).toContain("Line 2");
    expect(frame).toContain("Line 3");
  });

  it("truncates long messages", () => {
    const longMessage = "A".repeat(600);
    const { lastFrame } = render(<SuccessMessage message={longMessage} />);

    const frame = lastFrame() || "";
    expect(frame).toContain("...");
    // Frame should not contain the full untruncated message
    expect(frame).not.toContain(longMessage);
  });

  it("truncates long detail lines", () => {
    const longDetails = "B".repeat(600);
    const { lastFrame } = render(
      <SuccessMessage message="Success" details={longDetails} />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("...");
  });

  it("handles empty details gracefully", () => {
    const { lastFrame } = render(
      <SuccessMessage message="Success" details={undefined} />,
    );

    expect(lastFrame()).toContain("Success");
  });

  it("handles empty message", () => {
    const { lastFrame } = render(<SuccessMessage message="" />);

    expect(lastFrame()).toContain("✓");
  });
});

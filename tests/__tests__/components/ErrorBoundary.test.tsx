/**
 * Tests for ErrorBoundary component
 */
import React from "react";
import { jest } from "@jest/globals";
import { render } from "ink-testing-library";
import { ErrorBoundary } from "../../../src/components/ErrorBoundary.js";
import { Text } from "ink";

// Component that throws an error
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <Text>Normal render</Text>;
};

describe("ErrorBoundary", () => {
  // Suppress console.error for expected errors
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it("renders children when no error", () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <Text>Test content</Text>
      </ErrorBoundary>,
    );
    expect(lastFrame()).toContain("Test content");
  });

  it("catches errors and displays error UI", () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Rendering Error");
    expect(frame).toContain("Test error message");
  });

  it("shows Ctrl+C exit instruction on error", () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(lastFrame()).toContain("Ctrl+C");
  });

  it("renders custom fallback when provided", () => {
    const CustomFallback = <Text>Custom error fallback</Text>;

    const { lastFrame } = render(
      <ErrorBoundary fallback={CustomFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(lastFrame()).toContain("Custom error fallback");
  });

  it("is a class component", () => {
    expect(ErrorBoundary.prototype).toHaveProperty("render");
    expect(ErrorBoundary.prototype).toHaveProperty("componentDidCatch");
  });

  it("has getDerivedStateFromError static method", () => {
    expect(ErrorBoundary.getDerivedStateFromError).toBeDefined();

    const error = new Error("Test");
    const state = ErrorBoundary.getDerivedStateFromError(error);

    expect(state.hasError).toBe(true);
    expect(state.error).toBe(error);
  });
});

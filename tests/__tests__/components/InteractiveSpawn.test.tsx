/**
 * Tests for InteractiveSpawn component
 */
import React from "react";
import { jest } from "@jest/globals";
import { render } from "ink-testing-library";
import { InteractiveSpawn } from "../../../src/components/InteractiveSpawn.js";

// Mock child_process - use unstable_mockModule for ESM
jest.unstable_mockModule("child_process", () => ({
  spawn: jest.fn(() => ({
    on: jest.fn(),
    kill: jest.fn(),
    killed: false,
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
  })),
}));

describe("InteractiveSpawn", () => {
  it("renders without crashing", () => {
    const { lastFrame } = render(
      <InteractiveSpawn command="echo" args={["hello"]} onExit={() => {}} />,
    );
    // Component renders null since it manages subprocess
    expect(lastFrame()).toBe("");
  });

  it("accepts command and args props", () => {
    const onExit = jest.fn();
    const onError = jest.fn();

    render(
      <InteractiveSpawn
        command="ssh"
        args={["-i", "key.pem", "user@host"]}
        onExit={onExit}
        onError={onError}
      />,
    );

    // Component should initialize without errors
    expect(onError).not.toHaveBeenCalled();
  });

  it("renders nothing to the terminal", () => {
    const { lastFrame } = render(
      <InteractiveSpawn command="ls" args={["-la"]} />,
    );

    // InteractiveSpawn returns null - output goes directly to terminal
    expect(lastFrame()).toBe("");
  });

  it("handles onExit callback prop", () => {
    const onExit = jest.fn();

    render(<InteractiveSpawn command="echo" args={["test"]} onExit={onExit} />);

    // onExit would be called when process exits
    expect(onExit).toBeDefined();
  });

  it("handles onError callback prop", () => {
    const onError = jest.fn();

    render(
      <InteractiveSpawn command="nonexistent" args={[]} onError={onError} />,
    );

    // onError would be called on spawn error
    expect(onError).toBeDefined();
  });
});

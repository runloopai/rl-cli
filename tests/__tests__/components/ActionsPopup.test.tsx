/**
 * Tests for ActionsPopup component
 */
import React from "react";
import { render } from "ink-testing-library";
import { ActionsPopup } from "../../../src/components/ActionsPopup.js";

describe("ActionsPopup", () => {
  const mockDevbox = { id: "dbx_123", name: "test-devbox" };
  const mockOperations = [
    {
      key: "logs",
      label: "View Logs",
      color: "blue",
      icon: "ℹ",
      shortcut: "l",
    },
    {
      key: "exec",
      label: "Execute",
      color: "green",
      icon: "▶",
      shortcut: "e",
    },
  ];

  it("renders without crashing", () => {
    const { lastFrame } = render(
      <ActionsPopup
        devbox={mockDevbox}
        operations={mockOperations}
        selectedOperation={0}
        onClose={() => {}}
      />,
    );

    expect(lastFrame()).toBeTruthy();
  });

  it("displays the Quick Actions title", () => {
    const { lastFrame } = render(
      <ActionsPopup
        devbox={mockDevbox}
        operations={mockOperations}
        selectedOperation={0}
        onClose={() => {}}
      />,
    );

    expect(lastFrame()).toContain("Quick Actions");
  });

  it("renders all operations", () => {
    const { lastFrame } = render(
      <ActionsPopup
        devbox={mockDevbox}
        operations={mockOperations}
        selectedOperation={0}
        onClose={() => {}}
      />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("View Logs");
    expect(frame).toContain("Execute");
  });

  it("shows keyboard shortcuts", () => {
    const { lastFrame } = render(
      <ActionsPopup
        devbox={mockDevbox}
        operations={mockOperations}
        selectedOperation={0}
        onClose={() => {}}
      />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("[l]");
    expect(frame).toContain("[e]");
  });

  it("displays navigation hints", () => {
    const { lastFrame } = render(
      <ActionsPopup
        devbox={mockDevbox}
        operations={mockOperations}
        selectedOperation={0}
        onClose={() => {}}
      />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Nav");
    expect(frame).toContain("Enter");
    expect(frame).toContain("Esc");
  });
});

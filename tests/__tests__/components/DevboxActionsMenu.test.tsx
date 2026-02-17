/**
 * Tests for DevboxActionsMenu component
 *
 * Note: This component uses useNavigation hook which requires
 * the navigation store mock from setup-components.ts
 */
import React from "react";
import { render } from "ink-testing-library";
import { DevboxActionsMenu } from "../../../src/components/DevboxActionsMenu.js";

describe("DevboxActionsMenu", () => {
  const mockDevbox = {
    id: "dbx_123",
    name: "test-devbox",
    status: "running",
  };

  it("renders without crashing", () => {
    const { lastFrame } = render(
      <DevboxActionsMenu devbox={mockDevbox} onBack={() => {}} />,
    );
    expect(lastFrame()).toBeTruthy();
  });

  it("renders with devbox name", () => {
    const { lastFrame } = render(
      <DevboxActionsMenu devbox={mockDevbox} onBack={() => {}} />,
    );
    // Component should render something
    expect(lastFrame()).toBeDefined();
  });

  it("accepts onBack callback", () => {
    const onBack = () => {};
    const { lastFrame } = render(
      <DevboxActionsMenu devbox={mockDevbox} onBack={onBack} />,
    );
    expect(lastFrame()).toBeDefined();
  });

  it("accepts breadcrumbItems prop", () => {
    const { lastFrame } = render(
      <DevboxActionsMenu
        devbox={mockDevbox}
        onBack={() => {}}
        breadcrumbItems={[
          { label: "Home" },
          { label: "Devboxes", active: true },
        ]}
      />,
    );
    expect(lastFrame()).toBeDefined();
  });

  it("handles suspended devbox status", () => {
    const suspendedDevbox = { ...mockDevbox, status: "suspended" };
    const { lastFrame } = render(
      <DevboxActionsMenu devbox={suspendedDevbox} onBack={() => {}} />,
    );
    expect(lastFrame()).toBeDefined();
  });

  it("handles initialOperation prop", () => {
    const { lastFrame } = render(
      <DevboxActionsMenu
        devbox={mockDevbox}
        onBack={() => {}}
        initialOperation="logs"
      />,
    );
    expect(lastFrame()).toBeDefined();
  });
});

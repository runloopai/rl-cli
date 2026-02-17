/**
 * Tests for ResourceActionsMenu component
 *
 * Note: This component uses useNavigation hook which requires
 * the navigation store mock from setup-components.ts
 */
import React from "react";
import { render } from "ink-testing-library";
import { ResourceActionsMenu } from "../../../src/components/ResourceActionsMenu.js";

describe("ResourceActionsMenu", () => {
  describe("devbox mode", () => {
    const mockDevbox = {
      id: "dbx_123",
      name: "test-devbox",
      status: "running",
    };

    it("renders without crashing", () => {
      const { lastFrame } = render(
        <ResourceActionsMenu
          resourceType="devbox"
          resource={mockDevbox}
          onBack={() => {}}
        />,
      );
      expect(lastFrame()).toBeTruthy();
    });

    it("accepts resource prop", () => {
      const { lastFrame } = render(
        <ResourceActionsMenu
          resourceType="devbox"
          resource={mockDevbox}
          onBack={() => {}}
        />,
      );
      expect(lastFrame()).toBeDefined();
    });
  });

  describe("blueprint mode", () => {
    const mockBlueprint = {
      id: "bp_123",
      name: "test-blueprint",
    };

    const mockOperations = [
      {
        key: "logs",
        label: "View Logs",
        color: "blue",
        icon: "ℹ",
        shortcut: "l",
      },
      {
        key: "create",
        label: "Create Devbox",
        color: "green",
        icon: "▶",
        shortcut: "c",
      },
    ];

    it("renders without crashing", () => {
      const { lastFrame } = render(
        <ResourceActionsMenu
          resourceType="blueprint"
          resource={mockBlueprint}
          operations={mockOperations}
          onBack={() => {}}
          onExecute={async () => {}}
        />,
      );
      expect(lastFrame()).toBeTruthy();
    });

    it("accepts operations prop", () => {
      const { lastFrame } = render(
        <ResourceActionsMenu
          resourceType="blueprint"
          resource={mockBlueprint}
          operations={mockOperations}
          onBack={() => {}}
          onExecute={async () => {}}
        />,
      );
      expect(lastFrame()).toBeDefined();
    });

    it("accepts breadcrumbItems prop", () => {
      const { lastFrame } = render(
        <ResourceActionsMenu
          resourceType="blueprint"
          resource={mockBlueprint}
          operations={mockOperations}
          breadcrumbItems={[
            { label: "Custom" },
            { label: "Path", active: true },
          ]}
          onBack={() => {}}
          onExecute={async () => {}}
        />,
      );
      expect(lastFrame()).toBeDefined();
    });

    it("handles onExecute callback", () => {
      const onExecute = async () => {};
      const { lastFrame } = render(
        <ResourceActionsMenu
          resourceType="blueprint"
          resource={mockBlueprint}
          operations={mockOperations}
          onBack={() => {}}
          onExecute={onExecute}
        />,
      );
      expect(lastFrame()).toBeDefined();
    });
  });
});

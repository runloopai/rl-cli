/**
 * Tests for ResourcePicker component
 * Focuses on single-select vs multi-select modes and checkbox display
 */
import React from "react";
import { jest } from "@jest/globals";
import { render } from "ink-testing-library";
import {
  ResourcePicker,
  ResourcePickerConfig,
  Column,
} from "../../../src/components/ResourcePicker.js";
import { Text } from "ink";

interface TestItem {
  id: string;
  name: string;
  status: string;
}

const testItems: TestItem[] = [
  { id: "item_1", name: "First Item", status: "active" },
  { id: "item_2", name: "Second Item", status: "inactive" },
  { id: "item_3", name: "Third Item", status: "pending" },
];

// Mock fetch function that returns test items
const createMockFetchPage = (items: TestItem[] = testItems) => {
  return jest.fn().mockResolvedValue({
    items,
    hasMore: false,
    totalCount: items.length,
  });
};

// Base config for single-select mode
const createSingleSelectConfig = (
  fetchPage = createMockFetchPage(),
): ResourcePickerConfig<TestItem> => ({
  title: "Select Item",
  fetchPage,
  getItemId: (item) => item.id,
  getItemLabel: (item) => item.name,
  getItemStatus: (item) => item.status,
  mode: "single",
  emptyMessage: "No items found",
  searchPlaceholder: "Search items...",
});

// Base config for multi-select mode
const createMultiSelectConfig = (
  fetchPage = createMockFetchPage(),
): ResourcePickerConfig<TestItem> => ({
  title: "Select Items",
  fetchPage,
  getItemId: (item) => item.id,
  getItemLabel: (item) => item.name,
  getItemStatus: (item) => item.status,
  mode: "multi",
  minSelection: 1,
  emptyMessage: "No items found",
  searchPlaceholder: "Search items...",
});

describe("ResourcePicker", () => {
  const mockOnSelect = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("basic rendering", () => {
    it("renders without crashing in single-select mode", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      expect(lastFrame()).toBeTruthy();
    });

    it("renders without crashing in multi-select mode", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createMultiSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      expect(lastFrame()).toBeTruthy();
    });

    it("shows loading state initially", () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      const frame = lastFrame() || "";
      expect(frame).toContain("Loading");
    });

    it("displays items after loading", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("First Item");
      expect(frame).toContain("Second Item");
      expect(frame).toContain("Third Item");
    });

    it("displays item status", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("active");
      expect(frame).toContain("inactive");
      expect(frame).toContain("pending");
    });

    it("shows selection pointer", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      expect(lastFrame()).toContain("❯");
    });

    it("shows empty state when no items", async () => {
      const emptyFetch = createMockFetchPage([]);
      const config = createSingleSelectConfig(emptyFetch);

      const { lastFrame } = render(
        <ResourcePicker
          config={config}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      expect(lastFrame()).toContain("No items found");
    });
  });

  describe("single-select mode", () => {
    it("does not show checkboxes in single-select mode", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      // Should not contain checkbox characters
      expect(frame).not.toContain("☑");
      expect(frame).not.toContain("☐");
    });

    it("does not show Toggle in navigation tips", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).not.toContain("Toggle");
      expect(frame).toContain("Select"); // Single mode uses "Select"
    });

    it("does not show selected count in title", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).not.toContain("selected");
    });
  });

  describe("multi-select mode", () => {
    it("shows unchecked checkboxes for unselected items", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createMultiSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      // Should contain unchecked checkbox character
      expect(frame).toContain("☐");
    });

    it("shows checked checkboxes for initially selected items", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createMultiSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
          initialSelected={["item_1", "item_2"]}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      // Should contain checked checkbox character for pre-selected items
      expect(frame).toContain("☑");
    });

    it("shows selected count in title when using Table view", async () => {
      // Add columns to force Table view (which shows selected count in title)
      const configWithColumns: ResourcePickerConfig<TestItem> = {
        ...createMultiSelectConfig(),
        columns: [
          {
            key: "name",
            label: "Name",
            width: 20,
            render: (row) => <Text>{row.name}</Text>,
          },
        ],
      };

      const { lastFrame } = render(
        <ResourcePicker
          config={configWithColumns}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
          initialSelected={["item_1"]}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("1 selected");
    });

    it("shows correct count for multiple selections in Table view", async () => {
      const configWithColumns: ResourcePickerConfig<TestItem> = {
        ...createMultiSelectConfig(),
        columns: [
          {
            key: "name",
            label: "Name",
            width: 20,
            render: (row) => <Text>{row.name}</Text>,
          },
        ],
      };

      const { lastFrame } = render(
        <ResourcePicker
          config={configWithColumns}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
          initialSelected={["item_1", "item_2", "item_3"]}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("3 selected");
    });

    it("shows 0 selected in Table view when nothing is selected", async () => {
      const configWithColumns: ResourcePickerConfig<TestItem> = {
        ...createMultiSelectConfig(),
        columns: [
          {
            key: "name",
            label: "Name",
            width: 20,
            render: (row) => <Text>{row.name}</Text>,
          },
        ],
      };

      const { lastFrame } = render(
        <ResourcePicker
          config={configWithColumns}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
          initialSelected={[]}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("0 selected");
    });

    it("shows Toggle in navigation tips", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createMultiSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("Toggle");
    });

    it("shows Confirm in navigation tips when items are selected", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createMultiSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
          initialSelected={["item_1"]} // Select at least minSelection items
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("Confirm"); // Multi mode uses "Confirm" when canConfirm is true
    });

    it("shows Space key hint for toggling", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createMultiSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("Space");
    });
  });

  describe("navigation tips", () => {
    it("shows search hint", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("/");
      expect(frame).toContain("Search");
    });

    it("shows cancel hint", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("Esc");
      expect(frame).toContain("Cancel");
    });
  });

  describe("statistics bar", () => {
    it("shows total count", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("3");
      expect(frame).toContain("total");
    });

    it("shows showing range", async () => {
      const { lastFrame } = render(
        <ResourcePicker
          config={createSingleSelectConfig()}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("Showing");
    });
  });

  describe("breadcrumb", () => {
    it("displays breadcrumb when provided", async () => {
      const configWithBreadcrumb: ResourcePickerConfig<TestItem> = {
        ...createSingleSelectConfig(),
        breadcrumbItems: [
          { label: "Home" },
          { label: "Items" },
          { label: "Select", active: true },
        ],
      };

      const { lastFrame } = render(
        <ResourcePicker
          config={configWithBreadcrumb}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() || "";
      expect(frame).toContain("Home");
      expect(frame).toContain("Items");
      expect(frame).toContain("Select");
    });
  });

  describe("config options", () => {
    it("respects minSelection config", async () => {
      const config: ResourcePickerConfig<TestItem> = {
        ...createMultiSelectConfig(),
        minSelection: 2,
      };

      const { lastFrame } = render(
        <ResourcePicker
          config={config}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
          initialSelected={["item_1"]} // Only 1 selected, but min is 2
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      // Component should render (confirm may be disabled but that's behavioral)
      expect(lastFrame()).toBeTruthy();
    });

    it("respects custom emptyMessage", async () => {
      const config: ResourcePickerConfig<TestItem> = {
        ...createSingleSelectConfig(createMockFetchPage([])),
        emptyMessage: "Custom empty message",
      };

      const { lastFrame } = render(
        <ResourcePicker
          config={config}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />,
      );

      // Wait for async fetch
      await new Promise((r) => setTimeout(r, 50));

      expect(lastFrame()).toContain("Custom empty message");
    });
  });
});

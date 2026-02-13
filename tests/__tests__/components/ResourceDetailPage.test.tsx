/**
 * Tests for ResourceDetailPage component
 */
import React from "react";
import { Text } from "ink";
import { jest } from "@jest/globals";
import { render } from "ink-testing-library";
import {
  ResourceDetailPage,
  type DetailSection,
  type ResourceOperation,
} from "../../../src/components/ResourceDetailPage.js";
import { NavigationProvider } from "../../../src/store/navigationStore.js";

// Helper to wrap components with NavigationProvider
const renderWithNav = (ui: React.ReactElement) =>
  render(<NavigationProvider>{ui}</NavigationProvider>);

// Shared test data
interface TestResource {
  id: string;
  name: string;
  status: string;
}

const mockResource: TestResource = {
  id: "res_test_123",
  name: "test-resource",
  status: "running",
};

const mockOperations: ResourceOperation[] = [
  {
    key: "view-logs",
    label: "View Logs",
    color: "#00ff00",
    icon: "ℹ",
    shortcut: "l",
  },
  {
    key: "delete",
    label: "Delete Resource",
    color: "#ff0000",
    icon: "✖",
    shortcut: "d",
  },
];

const mockSections: DetailSection[] = [
  {
    title: "Details",
    icon: "■",
    color: "#ffaa00",
    fields: [
      { label: "Created", value: "2024-01-01" },
      { label: "Region", value: "us-east-1" },
    ],
  },
];

const createDefaultProps = () => ({
  resource: mockResource,
  resourceType: "Resources",
  getDisplayName: (r: TestResource) => r.name,
  getId: (r: TestResource) => r.id,
  getStatus: (r: TestResource) => r.status,
  detailSections: mockSections,
  operations: mockOperations,
  onOperation: jest.fn(),
  onBack: jest.fn(),
});

describe("ResourceDetailPage", () => {
  // --- Rendering ---

  it("renders without crashing", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} />,
    );
    expect(lastFrame()).toBeTruthy();
  });

  it("displays the resource name", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} />,
    );
    expect(lastFrame()).toContain("test-resource");
  });

  it("displays the resource ID when different from name", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} />,
    );
    expect(lastFrame()).toContain("res_test_123");
  });

  it("does not show separate ID when name equals ID", () => {
    const props = {
      ...createDefaultProps(),
      resource: { ...mockResource, name: "res_test_123" },
      getDisplayName: (r: TestResource) => r.id,
    };
    const { lastFrame } = renderWithNav(<ResourceDetailPage {...props} />);
    const frame = lastFrame() || "";
    // Should NOT contain the "• res_test_123" separator pattern (i.e. ID shown separately from name)
    expect(frame).not.toContain("• res_test_123");
  });

  it("displays the status badge", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} />,
    );
    expect(lastFrame()).toContain("Running");
  });

  // --- Detail Sections ---

  it("renders section titles", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} />,
    );
    expect(lastFrame()).toContain("Details");
  });

  it("renders field labels and values", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} />,
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Created");
    expect(frame).toContain("2024-01-01");
    expect(frame).toContain("Region");
    expect(frame).toContain("us-east-1");
  });

  it("filters out fields with undefined values", () => {
    const sections: DetailSection[] = [
      {
        title: "Info",
        fields: [
          { label: "Present", value: "yes" },
          { label: "Missing", value: undefined },
          { label: "Null", value: null },
        ],
      },
    ];
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} detailSections={sections} />,
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Present");
    expect(frame).not.toContain("Missing");
    expect(frame).not.toContain("Null");
  });

  it("renders multiple sections", () => {
    const sections: DetailSection[] = [
      { title: "Section A", fields: [{ label: "A1", value: "val1" }] },
      { title: "Section B", fields: [{ label: "B1", value: "val2" }] },
    ];
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} detailSections={sections} />,
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Section A");
    expect(frame).toContain("Section B");
  });

  // --- Operations ---

  it("renders the Actions section", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} />,
    );
    expect(lastFrame()).toContain("Actions");
  });

  it("displays all operations with labels", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} />,
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("View Logs");
    expect(frame).toContain("Delete Resource");
  });

  it("displays operation shortcuts", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} />,
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("[l]");
    expect(frame).toContain("[d]");
  });

  it("does not render Actions section when operations is empty", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} operations={[]} />,
    );
    const frame = lastFrame() || "";
    expect(frame).not.toContain("Actions");
  });

  // --- Actionable Fields ---

  it("renders actionable fields with label and value", () => {
    const sections: DetailSection[] = [
      {
        title: "Info",
        fields: [
          {
            label: "Blueprint",
            value: "bpt_123",
            action: {
              type: "navigate" as const,
              screen: "blueprint-detail" as const,
              params: { blueprintId: "bpt_123" },
              hint: "View Blueprint",
            },
          },
        ],
      },
    ];
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage
        {...createDefaultProps()}
        detailSections={sections}
      />,
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Blueprint");
    expect(frame).toContain("bpt_123");
  });

  // --- Navigation Tips ---

  it("shows navigation tips", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} />,
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Execute");
    expect(frame).toContain("Copy ID");
    expect(frame).toContain("Back");
  });

  it("shows Full Details tip when buildDetailLines is provided", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage
        {...createDefaultProps()}
        buildDetailLines={() => [<React.Fragment key="1" />]}
      />,
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Full Details");
  });

  it("shows Browser tip when getUrl is provided", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage
        {...createDefaultProps()}
        getUrl={() => "https://example.com"}
      />,
    );
    const frame = lastFrame() || "";
    expect(frame).toContain("Browser");
  });

  // --- Breadcrumbs ---

  it("shows resource type in breadcrumbs", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} />,
    );
    expect(lastFrame()).toContain("Resources");
  });

  it("shows custom breadcrumb prefix", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage
        {...createDefaultProps()}
        breadcrumbPrefix={[{ label: "Home" }]}
      />,
    );
    expect(lastFrame()).toContain("Home");
  });

  // --- Additional Content ---

  it("renders additional content", () => {
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage
        {...createDefaultProps()}
        additionalContent={<Text>Extra content here</Text>}
      />,
    );
    expect(lastFrame()).toContain("Extra content here");
  });

  // --- Selection state ---

  it("defaults selection to first operation (not links)", () => {
    const sections: DetailSection[] = [
      {
        title: "Info",
        fields: [
          {
            label: "Source",
            value: "bpt_123",
            action: {
              type: "navigate" as const,
              screen: "blueprint-detail" as const,
              params: { blueprintId: "bpt_123" },
              hint: "View Blueprint",
            },
          },
        ],
      },
    ];
    const { lastFrame } = renderWithNav(
      <ResourceDetailPage {...createDefaultProps()} detailSections={sections} />,
    );
    const frame = lastFrame() || "";
    // The link hint should NOT be visible since it's not selected
    expect(frame).not.toContain("View Blueprint");
    // The first operation should be rendered
    expect(frame).toContain("View Logs");
  });

  // --- Keyboard interaction ---

  it("calls onBack when escape is pressed", () => {
    const props = createDefaultProps();
    const { stdin } = renderWithNav(
      <ResourceDetailPage {...props} />,
    );
    stdin.write("\u001B"); // escape
    expect(props.onBack).toHaveBeenCalled();
  });

  it("calls onBack when q is pressed", () => {
    const props = createDefaultProps();
    const { stdin } = renderWithNav(
      <ResourceDetailPage {...props} />,
    );
    stdin.write("q");
    expect(props.onBack).toHaveBeenCalled();
  });

  it("calls onOperation with correct key when Enter is pressed on an operation", () => {
    const props = createDefaultProps();
    const { stdin } = renderWithNav(
      <ResourceDetailPage {...props} />,
    );
    // Default selection is the first operation, press Enter
    stdin.write("\r");
    expect(props.onOperation).toHaveBeenCalledWith("view-logs", mockResource);
  });

  it("calls onOperation via shortcut key", () => {
    const props = createDefaultProps();
    const { stdin } = renderWithNav(
      <ResourceDetailPage {...props} />,
    );
    // Press 'd' shortcut for delete
    stdin.write("d");
    expect(props.onOperation).toHaveBeenCalledWith("delete", mockResource);
  });

  it("triggers different operations via different shortcuts", () => {
    const props = createDefaultProps();
    const { stdin } = renderWithNav(
      <ResourceDetailPage {...props} />,
    );
    stdin.write("l");
    expect(props.onOperation).toHaveBeenCalledWith("view-logs", mockResource);
  });

  it("does not trigger operations for non-shortcut keys", () => {
    const props = createDefaultProps();
    const { stdin } = renderWithNav(
      <ResourceDetailPage {...props} />,
    );
    stdin.write("x"); // not a shortcut
    expect(props.onOperation).not.toHaveBeenCalled();
  });
});

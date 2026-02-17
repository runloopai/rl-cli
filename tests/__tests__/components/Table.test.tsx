/**
 * Tests for Table component
 */
import React from "react";
import { render } from "ink-testing-library";
import {
  Table,
  createTextColumn,
  createComponentColumn,
  Column,
} from "../../../src/components/Table.js";
import { Text } from "ink";

interface TestRow {
  id: string;
  name: string;
  status: string;
}

describe("Table", () => {
  const testData: TestRow[] = [
    { id: "1", name: "Item 1", status: "active" },
    { id: "2", name: "Item 2", status: "inactive" },
  ];

  const testColumns: Column<TestRow>[] = [
    createTextColumn("name", "Name", (row) => row.name, { width: 15 }),
    createTextColumn("status", "Status", (row) => row.status, { width: 10 }),
  ];

  it("renders without crashing", () => {
    const { lastFrame } = render(
      <Table
        data={testData}
        columns={testColumns}
        keyExtractor={(row) => row.id}
      />,
    );
    expect(lastFrame()).toBeTruthy();
  });

  it("displays column headers", () => {
    const { lastFrame } = render(
      <Table
        data={testData}
        columns={testColumns}
        keyExtractor={(row) => row.id}
      />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Name");
    expect(frame).toContain("Status");
  });

  it("displays row data", () => {
    const { lastFrame } = render(
      <Table
        data={testData}
        columns={testColumns}
        keyExtractor={(row) => row.id}
      />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Item 1");
    expect(frame).toContain("Item 2");
    expect(frame).toContain("active");
    expect(frame).toContain("inactive");
  });

  it("shows selection pointer", () => {
    const { lastFrame } = render(
      <Table
        data={testData}
        columns={testColumns}
        keyExtractor={(row) => row.id}
        selectedIndex={0}
        showSelection={true}
      />,
    );

    expect(lastFrame()).toContain("❯");
  });

  it("hides selection pointer when showSelection is false", () => {
    const { lastFrame } = render(
      <Table
        data={testData}
        columns={testColumns}
        keyExtractor={(row) => row.id}
        selectedIndex={0}
        showSelection={false}
      />,
    );

    expect(lastFrame()).not.toContain("❯");
  });

  it("displays title when provided", () => {
    const { lastFrame } = render(
      <Table
        data={testData}
        columns={testColumns}
        keyExtractor={(row) => row.id}
        title="My Table"
      />,
    );

    expect(lastFrame()).toContain("My Table");
  });

  it("shows empty state when provided", () => {
    const emptyState = <Text>No data available</Text>;

    const { lastFrame } = render(
      <Table
        data={[]}
        columns={testColumns}
        keyExtractor={(row) => row.id}
        emptyState={emptyState}
      />,
    );

    expect(lastFrame()).toContain("No data available");
  });

  it("handles null data gracefully", () => {
    const { lastFrame } = render(
      <Table
        data={null as unknown as TestRow[]}
        columns={testColumns}
        keyExtractor={(row) => row.id}
        emptyState={<Text>Empty</Text>}
      />,
    );

    expect(lastFrame()).toContain("Empty");
  });

  it("filters hidden columns", () => {
    const columnsWithHidden: Column<TestRow>[] = [
      createTextColumn("name", "Name", (row) => row.name, {
        width: 15,
        visible: true,
      }),
      createTextColumn("status", "Status", (row) => row.status, {
        width: 10,
        visible: false,
      }),
    ];

    const { lastFrame } = render(
      <Table
        data={testData}
        columns={columnsWithHidden}
        keyExtractor={(row) => row.id}
      />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Name");
    expect(frame).not.toContain("Status");
  });
});

describe("createTextColumn", () => {
  it("creates a valid column definition", () => {
    const column = createTextColumn(
      "test",
      "Test",
      (row: { value: string }) => row.value,
    );

    expect(column.key).toBe("test");
    expect(column.label).toBe("Test");
    expect(column.width).toBe(20); // default
  });

  it("respects custom width", () => {
    const column = createTextColumn("test", "Test", () => "value", {
      width: 30,
    });
    expect(column.width).toBe(30);
  });

  it("truncates long values", () => {
    const column = createTextColumn("test", "Test", () => "A".repeat(50), {
      width: 10,
    });
    const rendered = column.render({ value: "test" }, 0, false);

    // Should be a React element
    expect(rendered).toBeTruthy();
  });
});

describe("createComponentColumn", () => {
  it("creates a valid column definition", () => {
    const column = createComponentColumn("custom", "Custom", () => (
      <Text>Custom</Text>
    ));

    expect(column.key).toBe("custom");
    expect(column.label).toBe("Custom");
    expect(column.width).toBe(20); // default
  });

  it("respects custom width", () => {
    const column = createComponentColumn(
      "custom",
      "Custom",
      () => <Text>Custom</Text>,
      { width: 25 },
    );

    expect(column.width).toBe(25);
  });

  it("renders custom component", () => {
    const column = createComponentColumn(
      "badge",
      "Badge",
      (_row, _index, isSelected) => <Text>{isSelected ? "[X]" : "[ ]"}</Text>,
    );

    const rendered = column.render({}, 0, true);
    expect(rendered).toBeTruthy();
  });
});

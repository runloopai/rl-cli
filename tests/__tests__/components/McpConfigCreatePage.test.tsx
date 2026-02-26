/**
 * Tests for McpConfigCreatePage component
 */
import React from "react";
import { render } from "ink-testing-library";
import { McpConfigCreatePage } from "../../../src/components/McpConfigCreatePage.js";

describe("McpConfigCreatePage", () => {
  it("renders without crashing", () => {
    const { lastFrame } = render(<McpConfigCreatePage onBack={() => {}} />);
    expect(lastFrame()).toBeTruthy();
  });

  it("displays breadcrumb with Create label", () => {
    const { lastFrame } = render(<McpConfigCreatePage onBack={() => {}} />);

    const frame = lastFrame() || "";
    expect(frame).toContain("MCP Configs");
    expect(frame).toContain("Create");
  });

  it("shows Create MCP Config action button", () => {
    const { lastFrame } = render(<McpConfigCreatePage onBack={() => {}} />);
    expect(lastFrame()).toContain("Create MCP Config");
  });

  it("shows form fields", () => {
    const { lastFrame } = render(<McpConfigCreatePage onBack={() => {}} />);

    const frame = lastFrame() || "";
    expect(frame).toContain("Name");
    expect(frame).toContain("Endpoint URL");
    expect(frame).toContain("Allowed Tools");
    expect(frame).toContain("Description");
  });

  it("shows navigation help", () => {
    const { lastFrame } = render(<McpConfigCreatePage onBack={() => {}} />);

    const frame = lastFrame() || "";
    expect(frame).toContain("Create");
    expect(frame).toContain("Cancel");
  });

  it("shows Update MCP Config in edit mode", () => {
    const { lastFrame } = render(
      <McpConfigCreatePage
        onBack={() => {}}
        initialConfig={{
          id: "mcp_existing",
          name: "my-config",
          endpoint: "https://mcp.example.com",
          allowed_tools: ["*"],
        }}
      />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("Update MCP Config");
    expect(frame).toContain("Update");
  });

  it("pre-fills form fields in edit mode", () => {
    const { lastFrame } = render(
      <McpConfigCreatePage
        onBack={() => {}}
        initialConfig={{
          id: "mcp_existing",
          name: "my-config",
          endpoint: "https://mcp.example.com",
          allowed_tools: ["github.search_*", "github.get_*"],
          description: "Test description",
        }}
      />,
    );

    const frame = lastFrame() || "";
    expect(frame).toContain("my-config");
    expect(frame).toContain("https://mcp.example.com");
  });

  it("shows allowed tools help text", () => {
    const { lastFrame } = render(<McpConfigCreatePage onBack={() => {}} />);

    const frame = lastFrame() || "";
    expect(frame).toContain("Allowed Tools");
    expect(frame).toContain("all tools");
  });
});

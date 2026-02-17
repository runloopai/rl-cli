/**
 * Tests for UpdateNotification component
 */
import React from "react";
import { jest } from "@jest/globals";
import { render } from "ink-testing-library";
import { UpdateNotification } from "../../../src/components/UpdateNotification.js";

// Mock fetch
global.fetch = jest.fn() as jest.Mock;

describe("UpdateNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "0.1.0" }),
    });

    const { lastFrame } = render(<UpdateNotification />);
    expect(lastFrame()).toBeDefined();
  });

  it("shows nothing while checking", () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    const { lastFrame } = render(<UpdateNotification />);
    // Should be empty while checking
    expect(lastFrame()).toBe("");
  });

  it("shows nothing when on latest version", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "0.1.0" }), // Same as current
    });

    const { lastFrame } = render(<UpdateNotification />);

    // Wait for effect to run
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(lastFrame()).toBe("");
  });

  it("shows nothing on fetch error", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error"),
    );

    const { lastFrame } = render(<UpdateNotification />);

    // Wait for effect to run
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(lastFrame()).toBe("");
  });

  it("shows update notification when newer version available", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "99.99.99" }), // Much higher version
    });

    const { lastFrame } = render(<UpdateNotification />);

    // Wait for effect to run
    await new Promise((resolve) => setTimeout(resolve, 100));

    const frame = lastFrame() || "";
    // Should show update notification
    expect(frame).toContain("Update available");
    expect(frame).toContain("99.99.99");
  });

  it("shows npm install command", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "99.99.99" }),
    });

    const { lastFrame } = render(<UpdateNotification />);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(lastFrame()).toContain("npm i -g @runloop/rl-cli@latest");
  });

  it("handles non-ok response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const { lastFrame } = render(<UpdateNotification />);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(lastFrame()).toBe("");
  });
});

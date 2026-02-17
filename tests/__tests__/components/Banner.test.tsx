/**
 * Tests for Banner component
 */
import React from "react";
import { render } from "ink-testing-library";
import { Banner } from "../../../src/components/Banner.js";

describe("Banner", () => {
  it("renders without crashing", () => {
    const { lastFrame } = render(<Banner />);
    expect(lastFrame()).toBeTruthy();
  });

  it("is memoized", () => {
    // Banner is wrapped in React.memo
    expect(Banner).toBeDefined();
    expect(typeof Banner).toBe("object"); // React.memo returns an object
  });
});

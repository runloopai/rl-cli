/**
 * Tests for terminal screen buffer utilities.
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { processUtils } from "../../../src/utils/processUtils.js";
import {
  isInAlternateScreenBuffer,
  enterAlternateScreenBuffer,
  exitAlternateScreenBuffer,
} from "../../../src/utils/screen.js";

describe("alternate screen buffer tracking", () => {
  let originalWrite: typeof processUtils.stdout.write;

  beforeEach(() => {
    // Swallow the escape sequences so they don't leak into test output.
    originalWrite = processUtils.stdout.write;
    processUtils.stdout.write = () => true;
  });

  afterEach(() => {
    // Leave the buffer flag in a clean state for other tests.
    exitAlternateScreenBuffer();
    processUtils.stdout.write = originalWrite;
  });

  it("tracks enter and exit transitions", () => {
    expect(isInAlternateScreenBuffer()).toBe(false);

    enterAlternateScreenBuffer();
    expect(isInAlternateScreenBuffer()).toBe(true);

    exitAlternateScreenBuffer();
    expect(isInAlternateScreenBuffer()).toBe(false);
  });
});

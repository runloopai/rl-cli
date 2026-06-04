/**
 * Tests for RUNLOOP_BASE_URL handling, including optional port overrides.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import {
  checkBaseDomain,
  baseUrl,
  runloopBaseDomain,
  _resetBaseDomainCache,
} from "../../../src/utils/config.js";

describe("RUNLOOP_BASE_URL", () => {
  const original = process.env.RUNLOOP_BASE_URL;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;
  let errorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    _resetBaseDomainCache();
    exitSpy = jest.spyOn(process, "exit").mockImplementation(((
      code?: number,
    ) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (original === undefined) delete process.env.RUNLOOP_BASE_URL;
    else process.env.RUNLOOP_BASE_URL = original;
    exitSpy.mockRestore();
    errorSpy.mockRestore();
    _resetBaseDomainCache();
  });

  describe("checkBaseDomain", () => {
    it("accepts a bare api.<domain> URL", () => {
      process.env.RUNLOOP_BASE_URL = "https://api.runloop.pro";
      expect(() => checkBaseDomain()).not.toThrow();
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("accepts an api.<domain> URL with a port override", () => {
      process.env.RUNLOOP_BASE_URL = "https://api.runloop.pro:8443";
      expect(() => checkBaseDomain()).not.toThrow();
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("rejects a URL with a path", () => {
      process.env.RUNLOOP_BASE_URL = "https://api.runloop.pro/v1";
      expect(() => checkBaseDomain()).toThrow();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("rejects a URL with a query string", () => {
      process.env.RUNLOOP_BASE_URL = "https://api.runloop.pro?foo=bar";
      expect(() => checkBaseDomain()).toThrow();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("rejects a non-https URL", () => {
      process.env.RUNLOOP_BASE_URL = "http://api.runloop.pro:8443";
      expect(() => checkBaseDomain()).toThrow();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("baseUrl", () => {
    it("includes the port override in the API base URL", () => {
      process.env.RUNLOOP_BASE_URL = "https://api.runloop.pro:8443";
      expect(baseUrl()).toBe("https://api.runloop.pro:8443");
    });
  });

  describe("runloopBaseDomain", () => {
    it("strips the api. prefix and the port", () => {
      process.env.RUNLOOP_BASE_URL = "https://api.runloop.pro:8443";
      expect(runloopBaseDomain()).toBe("runloop.pro");
    });
  });
});

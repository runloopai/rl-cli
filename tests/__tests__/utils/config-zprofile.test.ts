import { extractRunloopApiKeyFromShellFile } from "../../../src/utils/config.js";

describe("extractRunloopApiKeyFromShellFile", () => {
  it("parses export with unquoted value", () => {
    expect(
      extractRunloopApiKeyFromShellFile(
        "export RUNLOOP_API_KEY=ak_test_123\n",
      ),
    ).toBe("ak_test_123");
  });

  it("parses assignment without export keyword", () => {
    expect(
      extractRunloopApiKeyFromShellFile("RUNLOOP_API_KEY=ak_plain\n"),
    ).toBe("ak_plain");
  });

  it("strips inline comment on unquoted line", () => {
    expect(
      extractRunloopApiKeyFromShellFile(
        "export RUNLOOP_API_KEY=ak_x  # my key\n",
      ),
    ).toBe("ak_x");
  });

  it("parses double-quoted value", () => {
    expect(
      extractRunloopApiKeyFromShellFile(
        'export RUNLOOP_API_KEY="ak_quoted"\n',
      ),
    ).toBe("ak_quoted");
  });

  it("parses single-quoted value", () => {
    expect(
      extractRunloopApiKeyFromShellFile(
        "export RUNLOOP_API_KEY='ak_single'\n",
      ),
    ).toBe("ak_single");
  });

  it("ignores comments and blank lines", () => {
    expect(
      extractRunloopApiKeyFromShellFile(
        "# comment\n\nexport OTHER=x\nexport RUNLOOP_API_KEY=ak_last\n",
      ),
    ).toBe("ak_last");
  });

  it("returns undefined when missing", () => {
    expect(extractRunloopApiKeyFromShellFile("export FOO=1\n")).toBeUndefined();
  });
});

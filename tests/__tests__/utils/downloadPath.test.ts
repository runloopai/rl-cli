/**
 * Tests for download path utilities
 */

import { describe, it, expect } from "@jest/globals";
import {
  inferDownloadExtension,
  getDefaultDownloadPath,
} from "../../../src/utils/downloadPath.js";

describe("inferDownloadExtension", () => {
  describe("no suffix on name", () => {
    it("appends .txt for text content type", () => {
      expect(inferDownloadExtension("myfile", "text")).toBe("myfile.txt");
    });

    it("appends .bin for binary content type", () => {
      expect(inferDownloadExtension("myfile", "binary")).toBe("myfile.bin");
    });

    it("appends .gz for gzip content type", () => {
      expect(inferDownloadExtension("myfile", "gzip")).toBe("myfile.gz");
    });

    it("appends .tar for tar content type", () => {
      expect(inferDownloadExtension("myfile", "tar")).toBe("myfile.tar");
    });

    it("appends .tgz for tgz content type", () => {
      expect(inferDownloadExtension("myfile", "tgz")).toBe("myfile.tgz");
    });

    it("appends .txt for dot-only hidden files with text type", () => {
      expect(inferDownloadExtension(".hidden", "text")).toBe(".hidden.txt");
    });
  });

  describe("suffix matches content type (no change)", () => {
    it("keeps .gz for gzip", () => {
      expect(inferDownloadExtension("myfile.gz", "gzip")).toBe("myfile.gz");
    });

    it("keeps .gzip for gzip", () => {
      expect(inferDownloadExtension("myfile.gzip", "gzip")).toBe(
        "myfile.gzip",
      );
    });

    it("keeps .taz for gzip", () => {
      expect(inferDownloadExtension("file.taz", "gzip")).toBe("file.taz");
    });

    it("keeps .tgz for gzip", () => {
      expect(inferDownloadExtension("file.tgz", "gzip")).toBe("file.tgz");
    });

    it("keeps .tar for tar", () => {
      expect(inferDownloadExtension("myfile.tar", "tar")).toBe("myfile.tar");
    });

    it("keeps .tgz for tgz", () => {
      expect(inferDownloadExtension("myfile.tgz", "tgz")).toBe("myfile.tgz");
    });

    it("keeps .taz for tgz", () => {
      expect(inferDownloadExtension("myfile.taz", "tgz")).toBe("myfile.taz");
    });

    it("keeps .tar.gz for tgz", () => {
      expect(inferDownloadExtension("myfile.tar.gz", "tgz")).toBe(
        "myfile.tar.gz",
      );
    });

    it("keeps .tar.gzip for tgz", () => {
      expect(inferDownloadExtension("data.tar.gzip", "tgz")).toBe(
        "data.tar.gzip",
      );
    });
  });

  describe("suffix mismatches content type (appends)", () => {
    it("appends .gz for gzip when suffix is .txt", () => {
      expect(inferDownloadExtension("myfile.txt", "gzip")).toBe(
        "myfile.txt.gz",
      );
    });

    it("appends .tar for tar when suffix is .json", () => {
      expect(inferDownloadExtension("myfile.json", "tar")).toBe(
        "myfile.json.tar",
      );
    });

    it("appends .tgz for tgz when suffix is .bin", () => {
      expect(inferDownloadExtension("myfile.bin", "tgz")).toBe(
        "myfile.bin.tgz",
      );
    });
  });

  describe("gzip + .tar special case", () => {
    it("replaces .tar with .tgz for gzip content type", () => {
      expect(inferDownloadExtension("archive.tar", "gzip")).toBe(
        "archive.tgz",
      );
    });

    it("replaces .TAR with .tgz for gzip content type (case-insensitive)", () => {
      expect(inferDownloadExtension("archive.TAR", "gzip")).toBe(
        "archive.tgz",
      );
    });
  });

  describe("text/binary with existing suffix (no change)", () => {
    it("keeps .json for text type", () => {
      expect(inferDownloadExtension("myfile.json", "text")).toBe("myfile.json");
    });

    it("keeps .yaml for text type", () => {
      expect(inferDownloadExtension("config.yaml", "text")).toBe("config.yaml");
    });

    it("keeps .wasm for binary type", () => {
      expect(inferDownloadExtension("myfile.wasm", "binary")).toBe(
        "myfile.wasm",
      );
    });

    it("keeps .exe for binary type", () => {
      expect(inferDownloadExtension("app.exe", "binary")).toBe("app.exe");
    });
  });

  describe("case insensitivity", () => {
    it("recognizes .GZ as matching gzip", () => {
      expect(inferDownloadExtension("myfile.GZ", "gzip")).toBe("myfile.GZ");
    });

    it("recognizes .TAR as matching tar", () => {
      expect(inferDownloadExtension("myfile.TAR", "tar")).toBe("myfile.TAR");
    });

    it("recognizes .Tgz as matching tgz", () => {
      expect(inferDownloadExtension("myfile.Tgz", "tgz")).toBe("myfile.Tgz");
    });

    it("recognizes .TAR.GZIP as matching tgz", () => {
      expect(inferDownloadExtension("data.TAR.GZIP", "tgz")).toBe(
        "data.TAR.GZIP",
      );
    });

    it("recognizes .TAR.GZ as matching tgz", () => {
      expect(inferDownloadExtension("data.TAR.GZ", "tgz")).toBe("data.TAR.GZ");
    });

    it("recognizes .Taz as matching tgz", () => {
      expect(inferDownloadExtension("data.Taz", "tgz")).toBe("data.Taz");
    });
  });

  describe("edge cases", () => {
    it("returns name unchanged for unspecified content type", () => {
      expect(inferDownloadExtension("myfile", "unspecified")).toBe("myfile");
    });

    it("returns name unchanged for undefined content type", () => {
      expect(inferDownloadExtension("myfile", undefined)).toBe("myfile");
    });

    it("returns name unchanged for empty string content type", () => {
      expect(inferDownloadExtension("myfile", "")).toBe("myfile");
    });
  });
});

describe("getDefaultDownloadPath", () => {
  it("uses name with extension inference", () => {
    expect(getDefaultDownloadPath("myfile", "obj_123", "text")).toBe(
      "./myfile.txt",
    );
  });

  it("falls back to id when name is undefined", () => {
    expect(getDefaultDownloadPath(undefined, "obj_123", "text")).toBe(
      "./obj_123.txt",
    );
  });

  it("falls back to id when name is empty", () => {
    expect(getDefaultDownloadPath("", "obj_123", "tar")).toBe("./obj_123.tar");
  });

  it("falls back to id when name is whitespace", () => {
    expect(getDefaultDownloadPath("  ", "obj_123", "binary")).toBe(
      "./obj_123.bin",
    );
  });

  it("trims name before processing", () => {
    expect(getDefaultDownloadPath("  myfile  ", "obj_123", "gzip")).toBe(
      "./myfile.gz",
    );
  });

  it("preserves existing matching extension", () => {
    expect(getDefaultDownloadPath("data.tar.gz", "obj_123", "tgz")).toBe(
      "./data.tar.gz",
    );
  });

  it("handles no content type", () => {
    expect(getDefaultDownloadPath("myfile", "obj_123", undefined)).toBe(
      "./myfile",
    );
  });
});

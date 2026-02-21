/**
 * Cartridge YAML parser
 */

import { readFileSync, existsSync } from "fs";
import { parse } from "yaml";
import type { DevboxCartridge } from "./types.js";

export function parseCartridge(filePath: string): DevboxCartridge {
  if (!existsSync(filePath)) {
    throw new Error(`Cartridge file not found: ${filePath}`);
  }

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read cartridge file: ${err instanceof Error ? err.message : err}`,
    );
  }

  let doc: unknown;
  try {
    doc = parse(raw);
  } catch (err) {
    throw new Error(
      `Failed to parse cartridge: ${err instanceof Error ? err.message : err}`,
    );
  }

  if (!doc || typeof doc !== "object") {
    throw new Error("Cartridge file is empty or not a valid YAML object");
  }

  const cartridge = doc as Record<string, unknown>;

  if (!cartridge.kind) {
    throw new Error("Cartridge missing required field: kind");
  }
  if (cartridge.kind !== "devbox") {
    throw new Error(
      `Unsupported cartridge kind: ${cartridge.kind}. Supported: devbox`,
    );
  }
  if (!cartridge.name) {
    throw new Error("Cartridge missing required field: name");
  }

  return doc as DevboxCartridge;
}

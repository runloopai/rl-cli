/**
 * useInputHandler - Declarative, mode-based input handling for Ink components.
 *
 * Replaces long imperative if/else chains in useInput callbacks with a
 * structured system of ordered modes, each with a key-binding map.
 * The first active mode wins; bindings are looked up by canonical key name.
 */
import { useInput, type Key } from "ink";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Canonical key names that can appear in a bindings map.
 *
 * Special keys use short names ("up", "enter", etc.).
 * Printable characters use the character itself ("a", "/", etc.).
 * Ctrl combinations use "ctrl+<char>" (e.g. "ctrl+c").
 */
export type KeyName =
  | "up"
  | "down"
  | "left"
  | "right"
  | "enter"
  | "escape"
  | "tab"
  | "backspace"
  | "delete"
  | "pageUp"
  | "pageDown"
  | (string & {}); // any single-char or "ctrl+x" string

/**
 * A single input mode. Modes are evaluated in order; the first whose
 * `active()` returns true handles the key event.
 */
export interface InputMode {
  /** Human-readable name (useful for debugging). */
  name: string;

  /** Return true when this mode should handle input. */
  active: () => boolean;

  /** Map of canonical key name -> handler. */
  bindings: Partial<Record<KeyName, () => void>>;

  /**
   * If true, keys that don't match any binding are silently swallowed
   * (the event does not fall through to subsequent modes).
   * Useful for modal overlays like search-input where you want to
   * prevent the underlying list from reacting.
   */
  captureAll?: boolean;

  /**
   * Called when no binding matched and captureAll is not set.
   * Receives the raw Ink `(input, key)` arguments so you can do
   * dynamic matching (e.g. operation shortcuts).
   * If provided, the event is consumed and does not fall through.
   */
  onUnmatched?: (input: string, key: Key) => void;
}

export interface UseInputHandlerOptions {
  /** Forwarded to Ink's useInput `isActive` option. */
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Key resolution
// ---------------------------------------------------------------------------

/**
 * Normalise Ink's (input, key) pair into a single canonical key name.
 *
 * Priority order (first match wins):
 *  1. Special keys (arrows, enter, escape, etc.)
 *  2. Ctrl+<char> combinations
 *  3. The raw `input` string (printable character)
 */
export function resolveKeyName(input: string, key: Key): KeyName {
  // Special keys
  if (key.upArrow) return "up";
  if (key.downArrow) return "down";
  if (key.leftArrow) return "left";
  if (key.rightArrow) return "right";
  if (key.return) return "enter";
  if (key.escape) return "escape";
  if (key.tab) return "tab";
  if (key.backspace) return "backspace";
  if (key.delete) return "delete";
  if (key.pageUp) return "pageUp";
  if (key.pageDown) return "pageDown";

  // Ctrl combinations (e.g. ctrl+c)
  if (key.ctrl && input) return `ctrl+${input}`;

  // Printable character
  return input;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Declarative input handler.
 *
 * @param modes  Ordered array of input modes. The first mode whose `active()`
 *               returns `true` gets to handle the key event.
 * @param options  Optional settings forwarded to Ink's useInput.
 */
export function useInputHandler(
  modes: InputMode[],
  options?: UseInputHandlerOptions,
): void {
  useInput(
    (input, key) => {
      const keyName = resolveKeyName(input, key);

      for (const mode of modes) {
        if (!mode.active()) continue;

        // Try an exact binding match
        const handler = mode.bindings[keyName];
        if (handler) {
          handler();
          return;
        }

        // No binding matched — try the dynamic fallback
        if (mode.onUnmatched) {
          mode.onUnmatched(input, key);
          return;
        }

        // captureAll: swallow the event silently
        if (mode.captureAll) return;

        // Default: first active mode consumes the event even if nothing matched
        return;
      }
    },
    { isActive: options?.isActive ?? true },
  );
}

// ---------------------------------------------------------------------------
// Preset binding helpers
// ---------------------------------------------------------------------------

/**
 * Common scroll bindings (j/k, arrows, page up/down).
 * Spread into a mode's `bindings` to get standard scrolling behaviour.
 */
export function scrollBindings(
  getScroll: () => number,
  setScroll: (value: number) => void,
): Partial<Record<KeyName, () => void>> {
  return {
    down: () => setScroll(getScroll() + 1),
    up: () => setScroll(Math.max(0, getScroll() - 1)),
    j: () => setScroll(getScroll() + 1),
    k: () => setScroll(Math.max(0, getScroll() - 1)),
    s: () => setScroll(getScroll() + 1),
    w: () => setScroll(Math.max(0, getScroll() - 1)),
    pageDown: () => setScroll(getScroll() + 10),
    pageUp: () => setScroll(Math.max(0, getScroll() - 10)),
  };
}

/**
 * Common up/down list navigation bindings.
 */
export function listNavBindings(
  getIndex: () => number,
  setIndex: (value: number) => void,
  getLength: () => number,
): Partial<Record<KeyName, () => void>> {
  return {
    up: () => setIndex(Math.max(0, getIndex() - 1)),
    down: () => setIndex(Math.min(getLength() - 1, getIndex() + 1)),
  };
}

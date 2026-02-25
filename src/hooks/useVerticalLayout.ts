/**
 * useVerticalLayout - Allocate vertical space so chrome + content total to terminal height.
 * Single source of truth for which components are compact and how many lines content gets.
 */
import React from "react";
import { useStdout } from "ink";
import type { BreadcrumbCompactMode } from "../components/Breadcrumb.js";

export type VerticalLayoutScreenType =
  | "list"
  | "detail"
  | "form"
  | "menu"
  | "logs"
  | "prompt"
  | "minimal";

export interface UseVerticalLayoutOptions {
  screenType: VerticalLayoutScreenType;
  /** List: search bar visible */
  hasSearch?: boolean;
  /** List: stats bar visible */
  hasStats?: boolean;
  /** Detail: number of operations (actions) to reserve lines for */
  operationCount?: number;
  /** Detail: max visible action rows before "View rest" (from terminal height when not set) */
  maxVisibleActions?: number;
}

export type NavTipsMode = "full" | "compact" | "keysOnly";

export interface VerticalLayoutResult {
  /** Lines available for main content (table body, detail sections, etc.) */
  contentLines: number;
  /** Terminal height in lines */
  terminalHeight: number;
  /** Terminal width in columns */
  terminalWidth: number;
  /** Breadcrumb mode from terminal width (horizontal compactness) */
  breadcrumbMode: BreadcrumbCompactMode;
  /** Nav tips mode (vertical compactness; short terminals use compact/keysOnly) */
  navTipsMode: NavTipsMode;
  /** Total chrome lines (for debugging or custom layout) */
  chromeLines: number;
  /** Detail: max action rows to show before "View rest" (responsive to height) */
  maxVisibleActions: number;
  /** When true, detail should render minimal top chrome so content fits and top is not cut off */
  minimalChrome: boolean;
}

// Height thresholds for nav tips and minimal chrome (vertical compactness)
const HEIGHT_FORCE_MINIMAL = 20;
const HEIGHT_FORCE_COMPACT = 28;
const HEIGHT_MINIMAL_CHROME = 18; // Below this, detail uses minimal top so nothing is cut off

// Width thresholds for breadcrumb (horizontal compactness only)
const BREADCRUMB_FULL_MIN_WIDTH = 70;
const BREADCRUMB_COMPACT_MIN_WIDTH = 45;

/** Max action rows to show before "View rest"; when plenty of height, show all; otherwise cap to save space. */
const HEIGHT_SHOW_ALL_ACTIONS = 42; // Above this, show all actions (no "View rest of Actions")

function getMaxVisibleActionsFromHeight(terminalHeight: number): number {
  if (terminalHeight >= HEIGHT_SHOW_ALL_ACTIONS) return 99; // Effectively show all
  if (terminalHeight < HEIGHT_FORCE_COMPACT) return 2;
  if (terminalHeight < 35) return 3;
  return 4;
}

function getBreadcrumbModeFromWidth(
  terminalWidth: number,
): BreadcrumbCompactMode {
  if (terminalWidth >= BREADCRUMB_FULL_MIN_WIDTH) return "full";
  if (terminalWidth >= BREADCRUMB_COMPACT_MIN_WIDTH) return "compact";
  return "minimal";
}

/** Breadcrumb mode: when height is small, use a smaller breadcrumb to save vertical space. */
function getBreadcrumbMode(
  terminalWidth: number,
  terminalHeight: number,
): BreadcrumbCompactMode {
  if (terminalHeight < HEIGHT_FORCE_MINIMAL) return "minimal";
  if (terminalHeight < HEIGHT_FORCE_COMPACT) return "compact";
  return getBreadcrumbModeFromWidth(terminalWidth);
}

function getChromeLines(
  screenType: VerticalLayoutScreenType,
  options: UseVerticalLayoutOptions,
  terminalHeight: number,
): number {
  const { hasSearch, hasStats, operationCount, maxVisibleActions } = options;
  switch (screenType) {
    case "list":
      // Match ResourceListView / devbox list overhead: 13 base + 2 if search
      return 13 + (hasSearch ? 2 : 0);
    case "detail": {
      // Very small height: use minimal chrome count so top is never cut off
      const useMinimalChrome = terminalHeight < HEIGHT_MINIMAL_CHROME;
      // Breadcrumb in full mode has border = 3 lines; compact/minimal = 1 line + margin. Title ~4, nav ~2.
      // Reserve for full breadcrumb so top is never cut: 3 + 4 + 2 = 9, plus 2 buffer = 11.
      const baseChrome = useMinimalChrome ? 5 : 11;
      const cap =
        maxVisibleActions ?? getMaxVisibleActionsFromHeight(terminalHeight);
      const actionsRows =
        operationCount != null && operationCount > 0 && !useMinimalChrome
          ? 2 + Math.min(operationCount, cap + 1)
          : 0;
      const raw = baseChrome + actionsRows;
      // Never reserve more than we have so content fits and top is visible
      return Math.min(raw, Math.max(1, terminalHeight - 1));
    }
    case "form":
    case "menu":
    case "logs":
    case "prompt":
      return 1 + 1 + 2; // breadcrumb + margin + nav tips
    case "minimal":
      return 1 + 1; // breadcrumb + margin only
    default:
      return 10;
  }
}

function getNavTipsModeFromHeight(terminalHeight: number): NavTipsMode {
  if (terminalHeight < HEIGHT_FORCE_MINIMAL) return "keysOnly";
  if (terminalHeight < HEIGHT_FORCE_COMPACT) return "compact";
  return "full";
}

function getSafeTerminalSize(
  stdout: { columns?: number; rows?: number } | undefined,
): { width: number; height: number } {
  const width = stdout?.columns && stdout.columns > 0 ? stdout.columns : 80;
  const height = stdout?.rows && stdout.rows > 0 ? stdout.rows : 24;
  return {
    width: Math.max(40, Math.min(300, width)),
    height: Math.max(10, Math.min(200, height)),
  };
}

/**
 * Compute vertical layout: chrome line count and content lines so that
 * chrome + content = terminalHeight. Returns content lines and per-component modes.
 */
export function useVerticalLayout(
  options: UseVerticalLayoutOptions,
): VerticalLayoutResult {
  const { screenType } = options;
  const { stdout } = useStdout();
  const [size, setSize] = React.useState(() => getSafeTerminalSize(stdout));

  React.useEffect(() => {
    if (!stdout) return;
    const handleResize = () => setSize(getSafeTerminalSize(stdout));
    stdout.on("resize", handleResize);
    handleResize();
    return () => {
      stdout.off("resize", handleResize);
    };
  }, [stdout]);

  const terminalHeight = size.height;
  const terminalWidth = size.width;
  const maxVisibleActions =
    options.maxVisibleActions ??
    (screenType === "detail"
      ? getMaxVisibleActionsFromHeight(terminalHeight)
      : 4);
  const chromeLines = getChromeLines(
    screenType,
    {
      ...options,
      maxVisibleActions,
    },
    terminalHeight,
  );
  const contentLines = Math.max(0, terminalHeight - chromeLines);
  const breadcrumbMode = getBreadcrumbMode(terminalWidth, terminalHeight);
  const navTipsMode = getNavTipsModeFromHeight(terminalHeight);
  const minimalChrome =
    screenType === "detail" && terminalHeight < HEIGHT_MINIMAL_CHROME;

  return {
    contentLines,
    terminalHeight,
    terminalWidth,
    breadcrumbMode,
    navTipsMode,
    chromeLines,
    maxVisibleActions,
    minimalChrome,
  };
}

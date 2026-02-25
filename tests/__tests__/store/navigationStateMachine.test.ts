/**
 * Unit tests for the pure navigation state machine.
 * No React, no Ink, no mocks — just state in, state out.
 */
import { describe, it, expect } from "@jest/globals";
import {
  initialNavigationState,
  getInitialState,
  navigate,
  push,
  replace,
  goBack,
  reset,
  canGoBack,
} from "../../../src/store/navigationStateMachine.js";
import type { ScreenName, RouteParams } from "../../../src/store/navigationStore.js";

describe("navigationStateMachine", () => {
  describe("initialNavigationState", () => {
    it("starts at menu with empty params and history", () => {
      expect(initialNavigationState.currentScreen).toBe("menu");
      expect(initialNavigationState.params).toEqual({});
      expect(initialNavigationState.history).toEqual([]);
    });
  });

  describe("getInitialState", () => {
    it("returns default state when no options", () => {
      const state = getInitialState({});
      expect(state).toEqual(initialNavigationState);
    });
    it("uses initialScreen and initialParams when provided", () => {
      const state = getInitialState({
        initialScreen: "devbox-detail" as ScreenName,
        initialParams: { devboxId: "dbx_1" } as RouteParams,
      });
      expect(state.currentScreen).toBe("devbox-detail");
      expect(state.params.devboxId).toBe("dbx_1");
      expect(state.history).toEqual([]);
    });
    it("uses initialHistory when provided", () => {
      const history = [{ screen: "menu" as ScreenName, params: {} as RouteParams }];
      const state = getInitialState({
        initialScreen: "devbox-list" as ScreenName,
        initialParams: {},
        initialHistory: history,
      });
      expect(state.history).toEqual(history);
    });
  });

  describe("navigate", () => {
    it("sets currentScreen and params and pushes previous onto history", () => {
      const state = navigate(initialNavigationState, "devbox-detail" as ScreenName, {
        devboxId: "dbx_1",
      } as RouteParams);
      expect(state.currentScreen).toBe("devbox-detail");
      expect(state.params.devboxId).toBe("dbx_1");
      expect(state.history).toHaveLength(1);
      expect(state.history[0]?.screen).toBe("menu");
      expect(state.history[0]?.params).toEqual({});
    });

    it("second navigate pushes previous screen onto history", () => {
      let state = navigate(initialNavigationState, "devbox-list" as ScreenName, {});
      state = navigate(state, "devbox-detail" as ScreenName, {
        devboxId: "dbx_1",
      } as RouteParams);
      expect(state.currentScreen).toBe("devbox-detail");
      expect(state.history).toHaveLength(2);
      expect(state.history[0]?.screen).toBe("menu");
      expect(state.history[1]?.screen).toBe("devbox-list");
    });

    it("uses empty params when not provided", () => {
      const state = navigate(initialNavigationState, "blueprint-list" as ScreenName);
      expect(state.params).toEqual({});
    });
  });

  describe("push", () => {
    it("behaves like navigate (push current onto history)", () => {
      const state = push(initialNavigationState, "secret-list" as ScreenName, {});
      expect(state.currentScreen).toBe("secret-list");
      expect(state.history).toHaveLength(1);
      expect(state.history[0]?.screen).toBe("menu");
    });
  });

  describe("replace", () => {
    it("changes screen and params but does not push history", () => {
      let state = navigate(initialNavigationState, "devbox-list" as ScreenName, {});
      const historyLength = state.history.length;
      state = replace(state, "devbox-detail" as ScreenName, {
        devboxId: "dbx_1",
      } as RouteParams);
      expect(state.currentScreen).toBe("devbox-detail");
      expect(state.params.devboxId).toBe("dbx_1");
      expect(state.history).toHaveLength(historyLength);
      // History unchanged: last entry is still the one before devbox-list (menu)
      expect(state.history[state.history.length - 1]?.screen).toBe("menu");
    });
  });

  describe("goBack", () => {
    it("pops history and returns to previous screen and params", () => {
      let state = navigate(initialNavigationState, "devbox-list" as ScreenName, {});
      state = navigate(state, "devbox-detail" as ScreenName, {
        devboxId: "dbx_1",
      } as RouteParams);
      state = goBack(state);
      expect(state.currentScreen).toBe("devbox-list");
      expect(state.history).toHaveLength(1);
      state = goBack(state);
      expect(state.currentScreen).toBe("menu");
      expect(state.params).toEqual({});
      expect(state.history).toHaveLength(0);
    });

    it("with empty history returns to menu with empty params and history", () => {
      const state = goBack(initialNavigationState);
      expect(state.currentScreen).toBe("menu");
      expect(state.params).toEqual({});
      expect(state.history).toEqual([]);
    });

    it("multiple back steps restore correct stack", () => {
      let state = navigate(initialNavigationState, "blueprint-list" as ScreenName, {});
      state = navigate(state, "blueprint-detail" as ScreenName, {
        blueprintId: "bpt_1",
      } as RouteParams);
      state = navigate(state, "blueprint-logs" as ScreenName, {
        blueprintId: "bpt_1",
      } as RouteParams);
      expect(state.history).toHaveLength(3);
      state = goBack(state);
      expect(state.currentScreen).toBe("blueprint-detail");
      state = goBack(state);
      expect(state.currentScreen).toBe("blueprint-list");
      state = goBack(state);
      expect(state.currentScreen).toBe("menu");
      state = goBack(state);
      expect(state.currentScreen).toBe("menu");
      expect(state.history).toEqual([]);
    });
  });

  describe("replace then goBack", () => {
    it("goBack returns to previous history entry (replace did not push)", () => {
      let state = navigate(initialNavigationState, "devbox-list" as ScreenName, {});
      state = replace(state, "devbox-detail" as ScreenName, {
        devboxId: "dbx_1",
      } as RouteParams);
      expect(state.history).toHaveLength(1);
      state = goBack(state);
      // Replace did not push devbox-list, so history still only has menu
      expect(state.currentScreen).toBe("menu");
    });
  });

  describe("reset", () => {
    it("returns to menu with empty params and history", () => {
      let state = navigate(initialNavigationState, "devbox-detail" as ScreenName, {
        devboxId: "dbx_1",
      } as RouteParams);
      state = navigate(state, "devbox-exec" as ScreenName, { executionId: "exec_1" } as RouteParams);
      state = reset(state);
      expect(state.currentScreen).toBe("menu");
      expect(state.params).toEqual({});
      expect(state.history).toEqual([]);
    });
  });

  describe("canGoBack", () => {
    it("returns false when history is empty", () => {
      expect(canGoBack(initialNavigationState)).toBe(false);
    });
    it("returns true when history has entries", () => {
      const state = navigate(initialNavigationState, "devbox-list" as ScreenName, {});
      expect(canGoBack(state)).toBe(true);
    });
    it("returns false after goBack to empty", () => {
      const state = goBack(initialNavigationState);
      expect(canGoBack(state)).toBe(false);
    });
  });
});

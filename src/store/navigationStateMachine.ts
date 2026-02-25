/**
 * Pure navigation state machine — no React, no side effects.
 * All transition logic lives here so it can be tested with zero rendering.
 */
import type { ScreenName, RouteParams } from "./navigationStore.js";

export interface NavigationState {
  currentScreen: ScreenName;
  params: RouteParams;
  history: Array<{ screen: ScreenName; params: RouteParams }>;
}

export const initialNavigationState: NavigationState = {
  currentScreen: "menu",
  params: {},
  history: [],
};

/**
 * Build initial state from optional screen/params/history (e.g. for tests or deep links).
 */
export function getInitialState(options: {
  initialScreen?: ScreenName;
  initialParams?: RouteParams;
  initialHistory?: Array<{ screen: ScreenName; params: RouteParams }>;
}): NavigationState {
  const screen = options.initialScreen ?? initialNavigationState.currentScreen;
  const params = options.initialParams ?? initialNavigationState.params;
  const history = options.initialHistory ?? initialNavigationState.history;
  return { currentScreen: screen, params, history };
}

/**
 * Navigate to a screen and push current screen onto history.
 */
export function navigate(
  state: NavigationState,
  screen: ScreenName,
  params: RouteParams = {},
): NavigationState {
  return {
    currentScreen: screen,
    params,
    history: [
      ...state.history,
      { screen: state.currentScreen, params: state.params },
    ],
  };
}

/**
 * Same as navigate — push current onto history and go to new screen.
 */
export function push(
  state: NavigationState,
  screen: ScreenName,
  params: RouteParams = {},
): NavigationState {
  return navigate(state, screen, params);
}

/**
 * Replace current screen without pushing to history.
 */
export function replace(
  state: NavigationState,
  screen: ScreenName,
  params: RouteParams = {},
): NavigationState {
  return {
    ...state,
    currentScreen: screen,
    params,
  };
}

/**
 * Go back to the previous screen. If history is empty, return to menu.
 */
export function goBack(state: NavigationState): NavigationState {
  if (state.history.length > 0) {
    const newHistory = state.history.slice(0, -1);
    const previous = state.history[state.history.length - 1]!;
    return {
      currentScreen: previous.screen,
      params: previous.params,
      history: newHistory,
    };
  }
  return {
    currentScreen: "menu",
    params: {},
    history: [],
  };
}

/**
 * Reset to menu with no history.
 */
export function reset(_state: NavigationState): NavigationState {
  return {
    currentScreen: "menu",
    params: {},
    history: [],
  };
}

/**
 * Whether there is a previous screen to go back to.
 */
export function canGoBack(state: NavigationState): boolean {
  return state.history.length > 0;
}

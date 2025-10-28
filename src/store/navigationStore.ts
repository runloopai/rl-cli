/**
 * Navigation Store - Manages screen navigation and routing state
 * Replaces useState for showDetails/showActions/showCreate patterns
 */
import { create } from "zustand";

export type ScreenName =
  | "menu"
  | "devbox-list"
  | "devbox-detail"
  | "devbox-actions"
  | "devbox-create"
  | "blueprint-list"
  | "blueprint-detail"
  | "snapshot-list"
  | "snapshot-detail";

export interface RouteParams {
  devboxId?: string;
  blueprintId?: string;
  snapshotId?: string;
  operation?: string;
  focusDevboxId?: string;
  status?: string;
  [key: string]: string | undefined;
}

export interface Route {
  screen: ScreenName;
  params: RouteParams;
}

interface NavigationState {
  // Current route
  currentScreen: ScreenName;
  params: RouteParams;

  // Navigation stack for back button
  stack: Route[];

  // Actions
  navigate: (screen: ScreenName, params?: RouteParams) => void;
  push: (screen: ScreenName, params?: RouteParams) => void;
  replace: (screen: ScreenName, params?: RouteParams) => void;
  goBack: () => void;
  reset: () => void;

  // Getters
  canGoBack: () => boolean;
  getCurrentRoute: () => Route;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentScreen: "menu",
  params: {},
  stack: [],

  navigate: (screen, params = {}) => {
    set((state) => ({
      currentScreen: screen,
      params,
      // Clear stack on navigate (not a push)
      stack: [],
    }));
  },

  push: (screen, params = {}) => {
    set((state) => ({
      currentScreen: screen,
      params,
      // Push current route to stack
      stack: [
        ...state.stack,
        { screen: state.currentScreen, params: state.params },
      ],
    }));
  },

  replace: (screen, params = {}) => {
    set((state) => ({
      currentScreen: screen,
      params,
      // Keep existing stack
    }));
  },

  goBack: () => {
    const state = get();
    if (state.stack.length > 0) {
      const previous = state.stack[state.stack.length - 1];
      set({
        currentScreen: previous.screen,
        params: previous.params,
        stack: state.stack.slice(0, -1),
      });
    } else {
      // No stack, go to menu
      set({
        currentScreen: "menu",
        params: {},
      });
    }
  },

  reset: () => {
    set({
      currentScreen: "menu",
      params: {},
      stack: [],
    });
  },

  canGoBack: () => {
    return get().stack.length > 0;
  },

  getCurrentRoute: () => {
    const state = get();
    return {
      screen: state.currentScreen,
      params: state.params,
    };
  },
}));

import React from "react";

export type ScreenName =
  | "menu"
  | "settings-menu"
  | "benchmark-menu"
  | "devbox-list"
  | "devbox-detail"
  | "devbox-actions"
  | "devbox-exec"
  | "devbox-create"
  | "blueprint-list"
  | "blueprint-detail"
  | "blueprint-logs"
  | "snapshot-list"
  | "snapshot-detail"
  | "network-policy-list"
  | "network-policy-detail"
  | "network-policy-create"
  | "secret-list"
  | "secret-detail"
  | "secret-create"
  | "object-list"
  | "object-detail"
  | "ssh-session"
  | "benchmark-run-list"
  | "benchmark-run-detail"
  | "scenario-run-list"
  | "scenario-run-detail";

export interface RouteParams {
  devboxId?: string;
  blueprintId?: string;
  blueprintName?: string;
  snapshotId?: string;
  networkPolicyId?: string;
  secretId?: string;
  objectId?: string;
  operation?: string;
  focusDevboxId?: string;
  status?: string;
  // SSH session params
  keyPath?: string;
  proxyCommand?: string;
  sshUser?: string;
  url?: string;
  devboxName?: string;
  returnScreen?: ScreenName;
  returnParams?: RouteParams;
  // Exec session params
  executionId?: string;
  execCommand?: string;
  // Benchmark params
  benchmarkRunId?: string;
  scenarioRunId?: string;
  [key: string]: string | ScreenName | RouteParams | undefined;
}

interface NavigationContextValue {
  currentScreen: ScreenName;
  params: RouteParams;
  navigate: (screen: ScreenName, params?: RouteParams) => void;
  push: (screen: ScreenName, params?: RouteParams) => void;
  replace: (screen: ScreenName, params?: RouteParams) => void;
  goBack: () => void;
  reset: () => void;
  canGoBack: () => boolean;
}

const NavigationContext = React.createContext<NavigationContextValue | null>(
  null,
);

export interface NavigationProviderProps {
  initialScreen?: ScreenName;
  initialParams?: RouteParams;
  children: React.ReactNode;
}

export function NavigationProvider({
  initialScreen = "menu",
  initialParams = {},
  children,
}: NavigationProviderProps) {
  // Use a single state object to avoid timing issues
  const [state, setState] = React.useState({
    currentScreen: initialScreen,
    params: initialParams,
    history: [] as Array<{ screen: ScreenName; params: RouteParams }>,
  });

  const navigate = React.useCallback(
    (screen: ScreenName, newParams: RouteParams = {}) => {
      setState((prev) => ({
        currentScreen: screen,
        params: newParams,
        history: [
          ...prev.history,
          { screen: prev.currentScreen, params: prev.params },
        ],
      }));
    },
    [],
  );

  const push = React.useCallback(
    (screen: ScreenName, newParams: RouteParams = {}) => {
      setState((prev) => ({
        currentScreen: screen,
        params: newParams,
        history: [
          ...prev.history,
          { screen: prev.currentScreen, params: prev.params },
        ],
      }));
    },
    [],
  );

  const replace = React.useCallback(
    (screen: ScreenName, newParams: RouteParams = {}) => {
      setState((prev) => ({
        ...prev,
        currentScreen: screen,
        params: newParams,
      }));
    },
    [],
  );

  const goBack = React.useCallback(() => {
    setState((prev) => {
      if (prev.history.length > 0) {
        const newHistory = [...prev.history];
        const previousScreen = newHistory.pop();

        return {
          currentScreen: previousScreen!.screen,
          params: previousScreen!.params,
          history: newHistory,
        };
      } else {
        // If no history, go to menu
        return {
          currentScreen: "menu",
          params: {},
          history: [],
        };
      }
    });
  }, []);

  const reset = React.useCallback(() => {
    setState({
      currentScreen: "menu",
      params: {},
      history: [],
    });
  }, []);

  const canGoBack = React.useCallback(
    () => state.history.length > 0,
    [state.history.length],
  );

  const value = React.useMemo(
    () => ({
      currentScreen: state.currentScreen,
      params: state.params,
      navigate,
      push,
      replace,
      goBack,
      reset,
      canGoBack,
    }),
    [
      state.currentScreen,
      state.params,
      navigate,
      push,
      replace,
      goBack,
      reset,
      canGoBack,
    ],
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = React.useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within NavigationProvider");
  }
  return context;
}

export function useNavigationStore<T = NavigationContextValue>(
  selector?: (state: NavigationContextValue) => T,
): T {
  const context = useNavigation();
  if (!selector) {
    return context as T;
  }
  return selector(context);
}

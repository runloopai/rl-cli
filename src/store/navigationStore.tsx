import React from "react";

export type ScreenName =
  | "menu"
  | "devbox-list"
  | "devbox-detail"
  | "devbox-actions"
  | "devbox-create"
  | "blueprint-list"
  | "blueprint-detail"
  | "snapshot-list"
  | "snapshot-detail"
  | "ssh-session";

export interface RouteParams {
  devboxId?: string;
  blueprintId?: string;
  snapshotId?: string;
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
  const [currentScreen, setCurrentScreen] =
    React.useState<ScreenName>(initialScreen);
  const [params, setParams] = React.useState<RouteParams>(initialParams);

  // Track navigation history stack
  // Start with empty history - screens are added when navigating away from them
  const [history, setHistory] = React.useState<
    Array<{ screen: ScreenName; params: RouteParams }>
  >([]);

  const navigate = (screen: ScreenName, newParams: RouteParams = {}) => {
    // Add current screen to history before navigating to new screen
    setHistory((prev) => [...prev, { screen: currentScreen, params }]);
    setCurrentScreen(screen);
    setParams(newParams);
  };

  const push = (screen: ScreenName, newParams: RouteParams = {}) => {
    // Add current screen to history before navigating to new screen
    setHistory((prev) => [...prev, { screen: currentScreen, params }]);
    setCurrentScreen(screen);
    setParams(newParams);
  };

  const replace = (screen: ScreenName, newParams: RouteParams = {}) => {
    // Replace current screen without adding to history
    setCurrentScreen(screen);
    setParams(newParams);
  };

  const goBack = () => {
    // Pop from history stack and navigate to previous screen
    if (history.length > 0) {
      const newHistory = [...history];
      const previousScreen = newHistory.pop(); // Remove and get last screen
      
      setHistory(newHistory);
      if (previousScreen) {
        setCurrentScreen(previousScreen.screen);
        setParams(previousScreen.params);
      }
    } else {
      // If no history, go to menu
      setCurrentScreen("menu");
      setParams({});
    }
  };

  const reset = () => {
    setCurrentScreen("menu");
    setParams({});
    setHistory([]);
  };

  const canGoBack = () => history.length > 0;

  const value = {
    currentScreen,
    params,
    navigate,
    push,
    replace,
    goBack,
    reset,
    canGoBack,
  };

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

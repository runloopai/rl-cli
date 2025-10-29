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

  const navigate = (screen: ScreenName, newParams: RouteParams = {}) => {
    setCurrentScreen(screen);
    setParams(newParams);
  };

  const push = (screen: ScreenName, newParams: RouteParams = {}) => {
    setCurrentScreen(screen);
    setParams(newParams);
  };

  const replace = (screen: ScreenName, newParams: RouteParams = {}) => {
    setCurrentScreen(screen);
    setParams(newParams);
  };

  const goBack = () => {
    setCurrentScreen("menu");
    setParams({});
  };

  const reset = () => {
    setCurrentScreen("menu");
    setParams({});
  };

  const canGoBack = () => false;

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

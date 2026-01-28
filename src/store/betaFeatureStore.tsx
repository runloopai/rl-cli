/**
 * Beta Feature Store - React context for managing beta feature flags
 *
 * Enable beta features by setting the environment variable:
 *   export RL_CLI_BETA=1
 *   export RL_CLI_BETA=true
 */
import React from "react";
import { isBetaEnabled } from "../utils/config.js";

interface BetaFeatureContextValue {
  /**
   * Whether beta features are enabled (via RL_CLI_BETA env var)
   */
  isBetaEnabled: boolean;

  /**
   * Check if a specific feature flag is enabled
   * Currently all beta features are controlled by the single RL_CLI_BETA flag,
   * but this allows for future granular control
   */
  isFeatureEnabled: (feature: BetaFeature) => boolean;
}

/**
 * Known beta features that can be enabled
 */
export type BetaFeature = "benchmarks";

const BetaFeatureContext = React.createContext<BetaFeatureContextValue | null>(
  null,
);

export interface BetaFeatureProviderProps {
  children: React.ReactNode;
}

export function BetaFeatureProvider({ children }: BetaFeatureProviderProps) {
  // Read beta status once on mount (env vars don't change during runtime)
  const betaEnabled = React.useMemo(() => isBetaEnabled(), []);

  const isFeatureEnabled = React.useCallback(
    (feature: BetaFeature): boolean => {
      // Currently all beta features are gated by the same flag
      // This can be extended to support per-feature flags in the future
      switch (feature) {
        case "benchmarks":
          return betaEnabled;
        default:
          return false;
      }
    },
    [betaEnabled],
  );

  const value = React.useMemo(
    () => ({
      isBetaEnabled: betaEnabled,
      isFeatureEnabled,
    }),
    [betaEnabled, isFeatureEnabled],
  );

  return (
    <BetaFeatureContext.Provider value={value}>
      {children}
    </BetaFeatureContext.Provider>
  );
}

/**
 * Hook to access beta feature flags
 */
export function useBetaFeatures(): BetaFeatureContextValue {
  const context = React.useContext(BetaFeatureContext);
  if (!context) {
    throw new Error(
      "useBetaFeatures must be used within BetaFeatureProvider",
    );
  }
  return context;
}

/**
 * Hook to check if a specific beta feature is enabled
 */
export function useBetaFeature(feature: BetaFeature): boolean {
  const { isFeatureEnabled } = useBetaFeatures();
  return isFeatureEnabled(feature);
}

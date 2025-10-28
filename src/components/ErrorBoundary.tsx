import React from "react";
import { Box, Text } from "ink";
import { colors } from "../utils/theme.js";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary to catch and handle React errors gracefully
 * Particularly useful for catching Yoga WASM layout errors
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box flexDirection="column" padding={1}>
          <Text color={colors.error} bold>
            ⚠️ Rendering Error
          </Text>
          <Text color={colors.textDim}>
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <Box marginTop={1}>
            <Text color={colors.textDim} dimColor>
              Press Ctrl+C to exit
            </Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}

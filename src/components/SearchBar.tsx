import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import figures from "figures";
import { colors } from "../utils/theme.js";

export interface SearchBarProps {
  /** Whether search input mode is active */
  searchMode: boolean;
  /** Current search query being typed */
  searchQuery: string;
  /** The submitted/active search query */
  submittedSearchQuery: string;
  /** Total count of results (after search filter) */
  resultCount: number;
  /** Callback when search query text changes */
  onSearchChange: (query: string) => void;
  /** Callback when search is submitted */
  onSearchSubmit: () => void;
  /** Placeholder text for search input */
  placeholder?: string;
  /** Maximum length to display for search query (truncates with ...) */
  maxDisplayLength?: number;
}

/**
 * Reusable search bar component for list views.
 * Displays either an input mode or the active search with result count.
 */
export function SearchBar({
  searchMode,
  searchQuery,
  submittedSearchQuery,
  resultCount,
  onSearchChange,
  onSearchSubmit,
  placeholder = "Type to search...",
  maxDisplayLength = 50,
}: SearchBarProps) {
  // Don't render if no search is active
  if (!searchMode && !submittedSearchQuery) {
    return null;
  }

  // Search input mode
  if (searchMode) {
    return (
      <Box marginBottom={1}>
        <Text color={colors.primary}>{figures.pointerSmall} Search: </Text>
        <TextInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder={placeholder}
          onSubmit={onSearchSubmit}
        />
        <Text color={colors.textDim} dimColor>
          {" "}
          [Enter to search, Esc to cancel]
        </Text>
      </Box>
    );
  }

  // Display active search with results
  const displayQuery =
    submittedSearchQuery.length > maxDisplayLength
      ? submittedSearchQuery.substring(0, maxDisplayLength) + "..."
      : submittedSearchQuery;

  return (
    <Box marginBottom={1}>
      <Text color={colors.primary}>{figures.info} Searching for: </Text>
      <Text color={colors.warning} bold>
        {displayQuery}
      </Text>
      <Text color={colors.textDim} dimColor>
        {" "}
        ({resultCount} results) [/ to edit, Esc to clear]
      </Text>
    </Box>
  );
}

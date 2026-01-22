import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { colors, sanitizeWidth } from "../utils/theme.js";

export interface Column<T> {
  /** Column key for identification */
  key: string;
  /** Column header label */
  label: string;
  /** Width of the column (number of characters) */
  width: number;
  /** Function to render the cell content */
  render: (row: T, index: number, isSelected: boolean) => React.ReactNode;
  /** Whether to show this column based on terminal width (optional) */
  visible?: boolean;
}

export interface TableProps<T> {
  /** Array of data rows */
  data: T[];
  /** Column definitions */
  columns: Column<T>[];
  /** Index of selected row (-1 for no selection) */
  selectedIndex?: number;
  /** Show selection pointer */
  showSelection?: boolean;
  /** Custom render for empty state */
  emptyState?: React.ReactNode;
  /** Row key extractor */
  keyExtractor: (row: T) => string;
  /** Optional title to display in border header */
  title?: string;
}

/**
 * Reusable table component for displaying lists of data with optional selection
 * Designed to be responsive and work across devboxes, blueprints, and snapshots
 */
export function Table<T>({
  data,
  columns,
  selectedIndex = -1,
  showSelection = true,
  emptyState,
  keyExtractor,
  title,
}: TableProps<T>) {
  // Safety: Handle null/undefined data
  if (!data || !Array.isArray(data)) {
    data = [];
  }

  const isEmpty = data.length === 0;

  // Filter visible columns
  const visibleColumns = columns.filter((col) => col.visible !== false);

  return (
    <Box flexDirection="column">
      {/* Title bar (if provided) */}
      {title && (
        <Box paddingX={1} marginBottom={0}>
          <Text color={colors.primary} bold>
            ╭─ {title.length > 50 ? title.substring(0, 50) + "..." : title}{" "}
            {"─".repeat(10)}╮
          </Text>
        </Box>
      )}

      <Box
        flexDirection="column"
        borderStyle={title ? "single" : "round"}
        borderColor={colors.border}
        paddingX={1}
      >
        {/* Header row */}
        <Box>
          {/* Space for selection pointer */}
          {showSelection && (
            <>
              <Text> </Text>
              <Text> </Text>
            </>
          )}

          {/* Column headers */}
          {visibleColumns.map((column) => {
            // Cap column width to prevent Yoga crashes from padEnd creating massive strings
            const safeWidth = sanitizeWidth(column.width, 1, 100);
            return (
              <Text key={`header-${column.key}`} bold dimColor>
                {column.label.slice(0, safeWidth).padEnd(safeWidth, " ")}
              </Text>
            );
          })}
        </Box>

        {/* Empty state row */}
        {isEmpty && (
          <Box paddingY={1}>
            {showSelection && (
              <>
                <Text> </Text>
                <Text> </Text>
              </>
            )}
            {emptyState || (
              <Text color={colors.textDim} dimColor>
                {figures.info} No items found
              </Text>
            )}
          </Box>
        )}

        {/* Data rows */}
        {data.map((row, index) => {
          const isSelected = index === selectedIndex;
          const rowKey = keyExtractor(row);

          return (
            <Box key={rowKey}>
              {/* Selection pointer */}
              {showSelection && (
                <>
                  <Text color={isSelected ? colors.primary : colors.textDim}>
                    {isSelected ? figures.pointer : " "}
                  </Text>
                  <Text> </Text>
                </>
              )}

              {/* Render each column */}
              {visibleColumns.map((column, colIndex) => (
                <React.Fragment key={`${rowKey}-${column.key}-${colIndex}`}>
                  {column.render(row, index, isSelected)}
                </React.Fragment>
              ))}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * Helper function to create a simple text column
 */
export function createTextColumn<T>(
  key: string,
  label: string,
  getValue: (row: T) => string,
  options?: {
    width?: number;
    color?: string;
    bold?: boolean;
    dimColor?: boolean;
    visible?: boolean;
  },
): Column<T> {
  return {
    key,
    label,
    width: options?.width || 20,
    visible: options?.visible,
    render: (row, index, isSelected) => {
      const value = String(getValue(row) || "");
      const rawWidth = options?.width || 20;
      // CRITICAL: Sanitize width to prevent padEnd from creating invalid strings that crash Yoga
      const width = sanitizeWidth(rawWidth, 1, 100);
      const color = options?.color || (isSelected ? colors.text : colors.text);
      const bold = options?.bold !== undefined ? options.bold : isSelected;
      const dimColor = options?.dimColor || false;

      // Truncate and add ellipsis if text is too long
      let truncated: string;
      if (value.length > width) {
        // Reserve space for ellipsis if truncating
        truncated = value.slice(0, Math.max(1, width - 1)) + "…";
      } else {
        truncated = value;
      }
      const padded = truncated.padEnd(width, " ");

      return (
        <Text
          color={isSelected ? colors.text : color}
          bold={bold}
          dimColor={dimColor}
          inverse={isSelected}
          wrap="truncate"
        >
          {padded}
        </Text>
      );
    },
  };
}

/**
 * Helper function to create a component column (for badges, icons, etc.)
 */
export function createComponentColumn<T>(
  key: string,
  label: string,
  renderComponent: (
    row: T,
    index: number,
    isSelected: boolean,
  ) => React.ReactNode,
  options?: {
    width?: number;
    visible?: boolean;
  },
): Column<T> {
  return {
    key,
    label,
    width: options?.width || 20,
    visible: options?.visible,
    render: renderComponent,
  };
}

import React from 'react';
import { Box, Text } from 'ink';
import figures from 'figures';

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
}: TableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  // Filter visible columns
  const visibleColumns = columns.filter(col => col.visible !== false);

  return (
    <Box flexDirection="column">
      {data.map((row, index) => {
        const isSelected = index === selectedIndex;
        const rowKey = keyExtractor(row);

        return (
          <Box key={rowKey}>
            {/* Selection pointer */}
            {showSelection && (
              <>
                <Text color={isSelected ? 'cyan' : 'gray'}>
                  {isSelected ? figures.pointer : ' '}
                </Text>
                <Text> </Text>
              </>
            )}

            {/* Render each column */}
            {visibleColumns.map((column, colIndex) => (
              <React.Fragment key={`${rowKey}-${column.key}`}>
                {column.render(row, index, isSelected)}
              </React.Fragment>
            ))}
          </Box>
        );
      })}
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
  }
): Column<T> {
  return {
    key,
    label,
    width: options?.width || 20,
    visible: options?.visible,
    render: (row, index, isSelected) => {
      const value = getValue(row);
      const width = options?.width || 20;
      const color = options?.color || (isSelected ? 'white' : 'white');
      const bold = options?.bold !== undefined ? options.bold : isSelected;
      const dimColor = options?.dimColor || false;

      // Pad the value to fill the full width
      const truncated = value.slice(0, width);
      const padded = truncated.padEnd(width, ' ');

      return (
        <Text color={isSelected ? 'white' : color} bold={bold} dimColor={!isSelected && dimColor} inverse={isSelected}>
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
  renderComponent: (row: T, index: number, isSelected: boolean) => React.ReactNode,
  options?: {
    width?: number;
    visible?: boolean;
  }
): Column<T> {
  return {
    key,
    label,
    width: options?.width || 20,
    visible: options?.visible,
    render: renderComponent,
  };
}

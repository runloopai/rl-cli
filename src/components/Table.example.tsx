/**
 * Example usage of the Table component for blueprints and snapshots
 *
 * This file demonstrates how to use the Table component for different entity types.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Table, createTextColumn, createComponentColumn } from './Table.js';
import { StatusBadge } from './StatusBadge.js';
import figures from 'figures';
import { colors } from '../utils/theme.js';

// ============================================================================
// EXAMPLE 1: Blueprints Table
// ============================================================================

interface Blueprint {
  id: string;
  name: string;
  status: string;
  created_at: number;
  description?: string;
}

function BlueprintsTable({
  blueprints,
  selectedIndex,
  terminalWidth
}: {
  blueprints: Blueprint[];
  selectedIndex: number;
  terminalWidth: number;
}) {
  // Responsive column widths
  const showDescription = terminalWidth >= 120;
  const showFullId = terminalWidth >= 80;

  return (
    <Table
      data={blueprints}
      keyExtractor={(bp: Blueprint) => bp.id}
      selectedIndex={selectedIndex}
      columns={[
        // Status badge column
        createComponentColumn<Blueprint>(
          'status',
          'Status',
          (bp) => <StatusBadge status={bp.status} showText={false} />,
          { width: 2 }
        ),
        // ID column (responsive)
        createTextColumn<Blueprint>(
          'id',
          'ID',
          (bp) => showFullId ? bp.id : bp.id.slice(0, 13),
          { width: showFullId ? 25 : 15, color: colors.textDim, dimColor: true, bold: false }
        ),
        // Name column
        createTextColumn<Blueprint>(
          'name',
          'Name',
          (bp) => bp.name || '(unnamed)',
          { width: 30 }
        ),
        // Description column (optional)
        createTextColumn<Blueprint>(
          'description',
          'Description',
          (bp) => bp.description || '',
          { width: 40, color: colors.textDim, dimColor: true, bold: false, visible: showDescription }
        ),
        // Created time column
        createTextColumn<Blueprint>(
          'created',
          'Created',
          (bp) => new Date(bp.created_at).toLocaleDateString(),
          { width: 15, color: colors.textDim, dimColor: true, bold: false }
        ),
      ]}
      emptyState={
        <Box>
          <Text color={colors.warning}>{figures.info} No blueprints found</Text>
        </Box>
      }
    />
  );
}

// ============================================================================
// EXAMPLE 2: Snapshots Table
// ============================================================================

interface Snapshot {
  id: string;
  name: string;
  status: string;
  devbox_id: string;
  created_at: number;
  size_gb?: number;
}

function SnapshotsTable({
  snapshots,
  selectedIndex,
  terminalWidth
}: {
  snapshots: Snapshot[];
  selectedIndex: number;
  terminalWidth: number;
}) {
  // Responsive column widths
  const showSize = terminalWidth >= 100;
  const showFullId = terminalWidth >= 80;

  return (
    <Table
      data={snapshots}
      keyExtractor={(snap: Snapshot) => snap.id}
      selectedIndex={selectedIndex}
      columns={[
        // Status badge column
        createComponentColumn<Snapshot>(
          'status',
          'Status',
          (snap) => <StatusBadge status={snap.status} showText={false} />,
          { width: 2 }
        ),
        // ID column (responsive)
        createTextColumn<Snapshot>(
          'id',
          'ID',
          (snap) => showFullId ? snap.id : snap.id.slice(0, 13),
          { width: showFullId ? 25 : 15, color: colors.textDim, dimColor: true, bold: false }
        ),
        // Name column
        createTextColumn<Snapshot>(
          'name',
          'Name',
          (snap) => snap.name || '(unnamed)',
          { width: 25 }
        ),
        // Devbox ID column
        createTextColumn<Snapshot>(
          'devbox',
          'Devbox',
          (snap) => snap.devbox_id.slice(0, 13),
          { width: 15, color: colors.primary, dimColor: true, bold: false }
        ),
        // Size column (optional)
        createTextColumn<Snapshot>(
          'size',
          'Size',
          (snap) => snap.size_gb ? `${snap.size_gb.toFixed(1)}GB` : '',
          { width: 10, color: colors.warning, dimColor: true, bold: false, visible: showSize }
        ),
        // Created time column
        createTextColumn<Snapshot>(
          'created',
          'Created',
          (snap) => new Date(snap.created_at).toLocaleDateString(),
          { width: 15, color: colors.textDim, dimColor: true, bold: false }
        ),
      ]}
      emptyState={
        <Box>
          <Text color={colors.warning}>{figures.info} No snapshots found</Text>
        </Box>
      }
    />
  );
}

// ============================================================================
// EXAMPLE 3: Custom Column with Complex Rendering
// ============================================================================

function CustomComplexColumn() {
  interface CustomEntity {
    id: string;
    name: string;
    tags: string[];
  }

  const data: CustomEntity[] = [
    { id: '1', name: 'Item 1', tags: ['tag1', 'tag2'] },
    { id: '2', name: 'Item 2', tags: ['tag3'] },
  ];

  return (
    <Table
      data={data}
      keyExtractor={(item: CustomEntity) => item.id}
      selectedIndex={0}
      columns={[
        createTextColumn<CustomEntity>(
          'name',
          'Name',
          (item) => item.name,
          { width: 20 }
        ),
        // Custom component column with complex rendering
        createComponentColumn<CustomEntity>(
          'tags',
          'Tags',
          (item, index, isSelected) => (
            <Box width={30}>
              <Text color={isSelected ? colors.primary : colors.info} dimColor>
                {item.tags.map(tag => `[${tag}]`).join(' ')}
              </Text>
            </Box>
          ),
          { width: 30 }
        ),
      ]}
    />
  );
}

// ============================================================================
// TIPS FOR USING THE TABLE COMPONENT
// ============================================================================

/**
 * TIPS:
 *
 * 1. Responsive Design:
 *    - Use terminal width to conditionally show/hide columns
 *    - Pass `visible: false` to columns that should be hidden on small terminals
 *
 * 2. Column Types:
 *    - Use `createTextColumn` for simple text content
 *    - Use `createComponentColumn` for badges, icons, or complex UI
 *
 * 3. Styling:
 *    - Set `color`, `bold`, and `dimColor` options in createTextColumn
 *    - For selected state, the Table handles highlighting automatically
 *
 * 4. Empty States:
 *    - Always provide an `emptyState` for better UX
 *    - Can be any React component
 *
 * 5. Key Extraction:
 *    - Always provide a unique `keyExtractor` function
 *    - Usually returns the entity's `id` field
 *
 * 6. Selection:
 *    - Pass `selectedIndex` to highlight a row
 *    - Pass -1 for no selection
 *    - Use `showSelection={false}` to hide the pointer
 */

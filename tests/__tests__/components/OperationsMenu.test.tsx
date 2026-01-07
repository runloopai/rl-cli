/**
 * Tests for OperationsMenu component
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { OperationsMenu, filterOperations, Operation } from '../../../src/components/OperationsMenu.js';

describe('OperationsMenu', () => {
  const mockOperations: Operation[] = [
    { key: 'view', label: 'View Details', color: 'blue', icon: 'ℹ' },
    { key: 'edit', label: 'Edit', color: 'green', icon: '✎' },
    { key: 'delete', label: 'Delete', color: 'red', icon: '✗' },
  ];

  it('renders without crashing', () => {
    const { lastFrame } = render(
      <OperationsMenu
        operations={mockOperations}
        selectedIndex={0}
        onNavigate={() => {}}
        onSelect={() => {}}
        onBack={() => {}}
      />
    );
    expect(lastFrame()).toBeTruthy();
  });

  it('displays Operations title', () => {
    const { lastFrame } = render(
      <OperationsMenu
        operations={mockOperations}
        selectedIndex={0}
        onNavigate={() => {}}
        onSelect={() => {}}
        onBack={() => {}}
      />
    );
    expect(lastFrame()).toContain('Operations');
  });

  it('renders all operations', () => {
    const { lastFrame } = render(
      <OperationsMenu
        operations={mockOperations}
        selectedIndex={0}
        onNavigate={() => {}}
        onSelect={() => {}}
        onBack={() => {}}
      />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('View Details');
    expect(frame).toContain('Edit');
    expect(frame).toContain('Delete');
  });

  it('shows icons for operations', () => {
    const { lastFrame } = render(
      <OperationsMenu
        operations={mockOperations}
        selectedIndex={0}
        onNavigate={() => {}}
        onSelect={() => {}}
        onBack={() => {}}
      />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('ℹ');
    expect(frame).toContain('✎');
    expect(frame).toContain('✗');
  });

  it('shows pointer for selected item', () => {
    const { lastFrame } = render(
      <OperationsMenu
        operations={mockOperations}
        selectedIndex={0}
        onNavigate={() => {}}
        onSelect={() => {}}
        onBack={() => {}}
      />
    );
    
    expect(lastFrame()).toContain('❯'); // figures.pointer
  });

  it('shows navigation help', () => {
    const { lastFrame } = render(
      <OperationsMenu
        operations={mockOperations}
        selectedIndex={0}
        onNavigate={() => {}}
        onSelect={() => {}}
        onBack={() => {}}
      />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Navigate');
    expect(frame).toContain('Select');
    expect(frame).toContain('Back');
  });

  it('shows additional actions when provided', () => {
    const { lastFrame } = render(
      <OperationsMenu
        operations={mockOperations}
        selectedIndex={0}
        onNavigate={() => {}}
        onSelect={() => {}}
        onBack={() => {}}
        additionalActions={[
          { key: 'r', label: 'Refresh', handler: () => {} },
        ]}
      />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('[r]');
    expect(frame).toContain('Refresh');
  });
});

describe('filterOperations', () => {
  const operations: Operation[] = [
    { key: 'view', label: 'View', color: 'blue', icon: 'i', needsInput: false },
    { key: 'edit', label: 'Edit', color: 'green', icon: 'e', needsInput: true },
    { key: 'delete', label: 'Delete', color: 'red', icon: 'x', needsInput: false },
  ];

  it('filters operations based on condition', () => {
    const filtered = filterOperations(operations, (op) => op.needsInput === false);
    
    expect(filtered).toHaveLength(2);
    expect(filtered.map(o => o.key)).toEqual(['view', 'delete']);
  });

  it('returns all operations when condition matches all', () => {
    const filtered = filterOperations(operations, () => true);
    expect(filtered).toHaveLength(3);
  });

  it('returns empty array when no operations match', () => {
    const filtered = filterOperations(operations, () => false);
    expect(filtered).toHaveLength(0);
  });

  it('filters by key', () => {
    const filtered = filterOperations(operations, (op) => op.key !== 'delete');
    
    expect(filtered).toHaveLength(2);
    expect(filtered.map(o => o.key)).toEqual(['view', 'edit']);
  });
});


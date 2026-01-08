/**
 * Tests for DetailView component
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { DetailView, buildDetailSections } from '../../../src/components/DetailView.js';

describe('DetailView', () => {
  it('renders without crashing', () => {
    const sections = [
      {
        title: 'Info',
        items: [
          { label: 'ID', value: '123' },
          { label: 'Name', value: 'Test' },
        ],
      },
    ];
    
    const { lastFrame } = render(<DetailView sections={sections} />);
    expect(lastFrame()).toBeTruthy();
  });

  it('displays section titles', () => {
    const sections = [
      {
        title: 'Basic Information',
        items: [{ label: 'ID', value: '123' }],
      },
    ];
    
    const { lastFrame } = render(<DetailView sections={sections} />);
    expect(lastFrame()).toContain('Basic Information');
  });

  it('displays labels and values', () => {
    const sections = [
      {
        title: 'Details',
        items: [
          { label: 'Status', value: 'running' },
          { label: 'Created', value: '2024-01-01' },
        ],
      },
    ];
    
    const { lastFrame } = render(<DetailView sections={sections} />);
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Status');
    expect(frame).toContain('running');
    expect(frame).toContain('Created');
    expect(frame).toContain('2024-01-01');
  });

  it('renders multiple sections', () => {
    const sections = [
      { title: 'Section 1', items: [{ label: 'A', value: '1' }] },
      { title: 'Section 2', items: [{ label: 'B', value: '2' }] },
    ];
    
    const { lastFrame } = render(<DetailView sections={sections} />);
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Section 1');
    expect(frame).toContain('Section 2');
  });
});

describe('buildDetailSections', () => {
  it('builds sections from data and config', () => {
    const data = {
      id: 'test-123',
      name: 'Test Name',
      status: 'active',
    };
    
    const config = {
      'Basic Info': {
        fields: [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
        ],
      },
      'Status': {
        fields: [
          { key: 'status', label: 'Current Status' },
        ],
      },
    };
    
    const sections = buildDetailSections(data, config);
    
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Basic Info');
    expect(sections[0].items).toHaveLength(2);
    expect(sections[1].title).toBe('Status');
  });

  it('filters out undefined/null values', () => {
    const data = {
      id: 'test-123',
      name: undefined,
      status: null,
    };
    
    const config = {
      'Info': {
        fields: [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status' },
        ],
      },
    };
    
    const sections = buildDetailSections(data, config);
    
    expect(sections[0].items).toHaveLength(1);
    expect(sections[0].items[0].label).toBe('ID');
  });

  it('applies custom formatters', () => {
    const data = {
      timestamp: 1704067200000, // 2024-01-01
    };
    
    const config = {
      'Dates': {
        fields: [
          {
            key: 'timestamp',
            label: 'Date',
            formatter: (val: unknown) => new Date(val as number).toISOString().split('T')[0],
          },
        ],
      },
    };
    
    const sections = buildDetailSections(data, config);
    
    expect(sections[0].items[0].value).toBe('2024-01-01');
  });
});


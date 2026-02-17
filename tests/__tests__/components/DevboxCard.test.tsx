/**
 * Tests for DevboxCard component
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { DevboxCard } from '../../../src/components/DevboxCard.js';

describe('DevboxCard', () => {
  it('renders without crashing', () => {
    const { lastFrame } = render(
      <DevboxCard
        id="dbx_123"
        status="running"
      />
    );
    expect(lastFrame()).toBeTruthy();
  });

  it('displays devbox id', () => {
    const { lastFrame } = render(
      <DevboxCard
        id="dbx_test_id"
        status="running"
      />
    );
    expect(lastFrame()).toContain('dbx_test_id');
  });

  it('displays devbox name when provided', () => {
    const { lastFrame } = render(
      <DevboxCard
        id="dbx_123"
        name="my-devbox"
        status="running"
      />
    );
    expect(lastFrame()).toContain('my-devbox');
  });

  it('shows running status icon', () => {
    const { lastFrame } = render(
      <DevboxCard
        id="dbx_123"
        status="running"
      />
    );
    expect(lastFrame()).toContain('✓'); // tick icon for running
  });

  it('shows provisioning status icon', () => {
    const { lastFrame } = render(
      <DevboxCard
        id="dbx_123"
        status="provisioning"
      />
    );
    expect(lastFrame()).toContain('…'); // ellipsis for provisioning
  });

  it('shows failed status icon', () => {
    const { lastFrame } = render(
      <DevboxCard
        id="dbx_123"
        status="failed"
      />
    );
    expect(lastFrame()).toContain('⚠'); // warning for failed
  });

  it('displays created date when provided', () => {
    const createdAt = '2024-01-15T10:00:00.000Z';
    const { lastFrame } = render(
      <DevboxCard
        id="dbx_123"
        status="running"
        createdAt={createdAt}
      />
    );
    
    // Should contain the date portion
    const frame = lastFrame() || '';
    expect(frame).toContain('1/15/2024');
  });

  it('truncates long names', () => {
    const longName = 'very-long-devbox-name-that-exceeds-limit';
    const { lastFrame } = render(
      <DevboxCard
        id="dbx_123"
        name={longName}
        status="running"
      />
    );
    
    const frame = lastFrame() || '';
    // Should be truncated to 18 chars
    expect(frame).toContain('very-long-devbox-n');
    expect(frame).not.toContain(longName);
  });
});


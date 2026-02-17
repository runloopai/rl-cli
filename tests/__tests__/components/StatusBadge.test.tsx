/**
 * Tests for StatusBadge component
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { StatusBadge, getStatusDisplay } from '../../../src/components/StatusBadge.js';

describe('StatusBadge', () => {
  it('renders without crashing', () => {
    const { lastFrame } = render(
      <StatusBadge status="running" />
    );
    expect(lastFrame()).toBeTruthy();
  });

  it('displays running status', () => {
    const { lastFrame } = render(
      <StatusBadge status="running" />
    );
    expect(lastFrame()).toContain('RUNNING');
  });

  it('displays provisioning status', () => {
    const { lastFrame } = render(
      <StatusBadge status="provisioning" />
    );
    expect(lastFrame()).toContain('PROVISION');
  });

  it('displays suspended status', () => {
    const { lastFrame } = render(
      <StatusBadge status="suspended" />
    );
    expect(lastFrame()).toContain('SUSPENDED');
  });

  it('displays failure status', () => {
    const { lastFrame } = render(
      <StatusBadge status="failure" />
    );
    expect(lastFrame()).toContain('FAILED');
  });

  it('displays shutdown status', () => {
    const { lastFrame } = render(
      <StatusBadge status="shutdown" />
    );
    expect(lastFrame()).toContain('SHUTDOWN');
  });

  it('hides text when showText is false', () => {
    const { lastFrame } = render(
      <StatusBadge status="running" showText={false} />
    );
    expect(lastFrame()).not.toContain('RUNNING');
  });

  it('shows icon when showText is false', () => {
    const { lastFrame } = render(
      <StatusBadge status="running" showText={false} />
    );
    // Should still show the icon (circleFilled)
    expect(lastFrame()).toContain('●');
  });

  it('handles unknown status', () => {
    const { lastFrame } = render(
      <StatusBadge status="unknown_status" />
    );
    // Should display padded status
    expect(lastFrame()).toBeTruthy();
  });

  it('handles empty status', () => {
    const { lastFrame } = render(
      <StatusBadge status="" />
    );
    expect(lastFrame()).toContain('UNKNOWN');
  });
});

describe('getStatusDisplay', () => {
  it('returns correct display for running', () => {
    const display = getStatusDisplay('running');
    expect(display.text.trim()).toBe('RUNNING');
    expect(display.icon).toBe('●');
  });

  it('returns correct display for provisioning', () => {
    const display = getStatusDisplay('provisioning');
    expect(display.text.trim()).toBe('PROVISION');
    expect(display.icon).toBe('↑');
  });

  it('returns correct display for initializing', () => {
    const display = getStatusDisplay('initializing');
    expect(display.text.trim()).toBe('INITIALIZE');
  });

  it('returns correct display for suspended', () => {
    const display = getStatusDisplay('suspended');
    expect(display.text.trim()).toBe('SUSPENDED');
  });

  it('returns correct display for failure', () => {
    const display = getStatusDisplay('failure');
    expect(display.text.trim()).toBe('FAILED');
    expect(display.icon).toBe('⚠');
  });

  it('returns correct display for resuming', () => {
    const display = getStatusDisplay('resuming');
    expect(display.text.trim()).toBe('RESUMING');
  });

  it('returns correct display for building', () => {
    const display = getStatusDisplay('building');
    expect(display.text.trim()).toBe('BUILDING');
  });

  it('returns correct display for build_complete', () => {
    const display = getStatusDisplay('build_complete');
    expect(display.text.trim()).toBe('COMPLETE');
  });

  it('returns unknown display for null status', () => {
    const display = getStatusDisplay(null as unknown as string);
    expect(display.text.trim()).toBe('UNKNOWN');
  });

  it('truncates and pads unknown statuses', () => {
    const display = getStatusDisplay('very_long_unknown_status');
    expect(display.text).toHaveLength(10);
  });
});


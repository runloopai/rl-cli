/**
 * Tests for Breadcrumb component
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { Breadcrumb } from '../../../src/components/Breadcrumb.js';
import { _resetBaseDomainCache } from '../../../src/utils/config.js';

describe('Breadcrumb', () => {
  it('renders without crashing', () => {
    const { lastFrame } = render(
      <Breadcrumb items={[{ label: 'Home', active: true }]} />
    );
    expect(lastFrame()).toBeTruthy();
  });

  it('displays the rl prefix', () => {
    const { lastFrame } = render(
      <Breadcrumb items={[{ label: 'Home', active: true }]} />
    );
    expect(lastFrame()).toContain('rl');
  });

  it('renders single breadcrumb item', () => {
    const { lastFrame } = render(
      <Breadcrumb items={[{ label: 'Devboxes', active: true }]} />
    );
    expect(lastFrame()).toContain('Devboxes');
  });

  it('renders multiple breadcrumb items with separators', () => {
    const { lastFrame } = render(
      <Breadcrumb items={[
        { label: 'Home' },
        { label: 'Devboxes' },
        { label: 'Detail', active: true }
      ]} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Home');
    expect(frame).toContain('Devboxes');
    expect(frame).toContain('Detail');
    expect(frame).toContain('›'); // separator
  });

  it('truncates long labels', () => {
    const longLabel = 'A'.repeat(100);
    const { lastFrame } = render(
      <Breadcrumb items={[{ label: longLabel, active: true }]} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('...');
    // Frame should not contain the full long label
    expect(frame).not.toContain(longLabel);
  });

  it('shows non-default domain indicator when RUNLOOP_BASE_URL is custom', () => {
    const originalUrl = process.env.RUNLOOP_BASE_URL;
    process.env.RUNLOOP_BASE_URL = 'https://api.runloop.pro';
    _resetBaseDomainCache();

    const { lastFrame } = render(
      <Breadcrumb items={[{ label: 'Home', active: true }]} />
    );

    expect(lastFrame()).toContain('runloop.pro');

    process.env.RUNLOOP_BASE_URL = originalUrl;
    _resetBaseDomainCache();
  });
});


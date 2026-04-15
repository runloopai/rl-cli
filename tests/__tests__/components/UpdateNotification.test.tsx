/**
 * Tests for UpdateNotification component.
 *
 * The component uses the useUpdateCheck hook which calls global.fetch
 * internally. We mock fetch to control update-check responses.
 *
 * Note: the setup-components.ts mocks for useUpdateCheck and
 * UpdateNotification don't apply here due to module path resolution
 * differences (.ts vs .js mapping), so the real component and hook run.
 */
import React from 'react';
import { jest } from '@jest/globals';
import { render } from 'ink-testing-library';
import { UpdateNotification } from '../../../src/components/UpdateNotification.js';

// Helper: wait for async state updates to propagate
function waitForUpdates(ms = 150): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('UpdateNotification', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders without crashing', () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.1.0' }),
    });

    const { lastFrame } = render(<UpdateNotification />);
    expect(lastFrame()).toBeDefined();
  });

  it('shows nothing while checking', () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    const { lastFrame } = render(<UpdateNotification />);
    expect(lastFrame()).toBe('');
  });

  it('shows nothing when on latest version', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.0.1' }), // Older than current
    });

    const { lastFrame } = render(<UpdateNotification />);
    await waitForUpdates();
    expect(lastFrame()).toBe('');
  });

  it('shows nothing on fetch error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error'),
    );

    const { lastFrame } = render(<UpdateNotification />);
    await waitForUpdates();
    expect(lastFrame()).toBe('');
  });

  it('shows update notification when newer version available', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '99.99.99' }),
    });

    const { lastFrame } = render(<UpdateNotification />);
    await waitForUpdates();

    const frame = lastFrame() || '';
    expect(frame).toContain('Update available');
    expect(frame).toContain('99.99.99');
  });

  it('shows npm install command', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '99.99.99' }),
    });

    const { lastFrame } = render(<UpdateNotification />);
    await waitForUpdates();
    expect(lastFrame()).toContain('npm i -g @runloop/rl-cli@latest');
  });

  it('shows nothing on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const { lastFrame } = render(<UpdateNotification />);
    await waitForUpdates();
    expect(lastFrame()).toBe('');
  });
});


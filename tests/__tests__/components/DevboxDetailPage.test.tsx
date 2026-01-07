/**
 * Tests for DevboxDetailPage component
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { DevboxDetailPage } from '../../../src/components/DevboxDetailPage.js';

describe('DevboxDetailPage', () => {
  const mockDevbox = {
    id: 'dbx_test_123',
    name: 'test-devbox',
    status: 'running',
    create_time_ms: Date.now() - 3600000, // 1 hour ago
    capabilities: ['shell', 'code'],
    launch_parameters: {
      architecture: 'arm64',
      resource_size_request: 'SMALL',
    },
  };

  it('renders without crashing', () => {
    const { lastFrame } = render(
      <DevboxDetailPage
        devbox={mockDevbox}
        onBack={() => {}}
      />
    );
    expect(lastFrame()).toBeTruthy();
  });

  it('displays devbox name', () => {
    const { lastFrame } = render(
      <DevboxDetailPage
        devbox={mockDevbox}
        onBack={() => {}}
      />
    );
    expect(lastFrame()).toContain('test-devbox');
  });

  it('displays devbox id', () => {
    const { lastFrame } = render(
      <DevboxDetailPage
        devbox={mockDevbox}
        onBack={() => {}}
      />
    );
    expect(lastFrame()).toContain('dbx_test_123');
  });

  it('shows status badge', () => {
    const { lastFrame } = render(
      <DevboxDetailPage
        devbox={mockDevbox}
        onBack={() => {}}
      />
    );
    expect(lastFrame()).toContain('RUNNING');
  });

  it('shows Actions section', () => {
    const { lastFrame } = render(
      <DevboxDetailPage
        devbox={mockDevbox}
        onBack={() => {}}
      />
    );
    expect(lastFrame()).toContain('Actions');
  });

  it('shows available operations', () => {
    const { lastFrame } = render(
      <DevboxDetailPage
        devbox={mockDevbox}
        onBack={() => {}}
      />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('View Logs');
    expect(frame).toContain('Execute Command');
  });

  it('shows navigation help', () => {
    const { lastFrame } = render(
      <DevboxDetailPage
        devbox={mockDevbox}
        onBack={() => {}}
      />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Navigate');
    expect(frame).toContain('Execute');
    expect(frame).toContain('Back');
  });

  it('displays resource information', () => {
    const { lastFrame } = render(
      <DevboxDetailPage
        devbox={mockDevbox}
        onBack={() => {}}
      />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Resources');
    expect(frame).toContain('SMALL');
    expect(frame).toContain('arm64');
  });

  it('displays capabilities', () => {
    const { lastFrame } = render(
      <DevboxDetailPage
        devbox={mockDevbox}
        onBack={() => {}}
      />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Capabilities');
    expect(frame).toContain('shell');
    expect(frame).toContain('code');
  });
});


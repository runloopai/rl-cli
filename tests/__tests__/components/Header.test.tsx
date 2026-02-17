/**
 * Tests for Header component
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { Header } from '../../../src/components/Header.js';

describe('Header', () => {
  it('renders without crashing', () => {
    const { lastFrame } = render(
      <Header title="Test Title" />
    );
    expect(lastFrame()).toBeTruthy();
  });

  it('displays the title', () => {
    const { lastFrame } = render(
      <Header title="My Header" />
    );
    expect(lastFrame()).toContain('My Header');
  });

  it('shows the vertical bar prefix', () => {
    const { lastFrame } = render(
      <Header title="Test" />
    );
    expect(lastFrame()).toContain('▌');
  });

  it('shows underline decoration', () => {
    const { lastFrame } = render(
      <Header title="Test" />
    );
    expect(lastFrame()).toContain('─');
  });

  it('displays subtitle when provided', () => {
    const { lastFrame } = render(
      <Header title="Title" subtitle="Subtitle text" />
    );
    expect(lastFrame()).toContain('Subtitle text');
  });

  it('truncates long titles', () => {
    const longTitle = 'A'.repeat(150);
    const { lastFrame } = render(
      <Header title={longTitle} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('...');
    // Title should be truncated - frame should not contain the full title
    expect(frame).not.toContain(longTitle);
  });

  it('truncates long subtitles', () => {
    const longSubtitle = 'B'.repeat(200);
    const { lastFrame } = render(
      <Header title="Title" subtitle={longSubtitle} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('...');
  });

  it('handles empty subtitle gracefully', () => {
    const { lastFrame } = render(
      <Header title="Title" subtitle={undefined} />
    );
    expect(lastFrame()).toContain('Title');
  });

  it('renders correct underline length', () => {
    const { lastFrame } = render(
      <Header title="Short" />
    );
    
    const frame = lastFrame() || '';
    // Underline should be proportional to title length
    const underlineCount = (frame.match(/─/g) || []).length;
    expect(underlineCount).toBeGreaterThan(0);
    expect(underlineCount).toBeLessThanOrEqual(101); // MAX_TITLE_LENGTH + 1
  });
});


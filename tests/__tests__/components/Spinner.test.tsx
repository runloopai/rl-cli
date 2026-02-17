/**
 * Tests for Spinner component
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { SpinnerComponent } from '../../../src/components/Spinner.js';

describe('SpinnerComponent', () => {
  it('renders without crashing', () => {
    const { lastFrame } = render(
      <SpinnerComponent message="Loading..." />
    );
    expect(lastFrame()).toBeTruthy();
  });

  it('displays the message', () => {
    const { lastFrame } = render(
      <SpinnerComponent message="Please wait" />
    );
    expect(lastFrame()).toContain('Please wait');
  });

  it('truncates long messages', () => {
    const longMessage = 'A'.repeat(300);
    const { lastFrame } = render(
      <SpinnerComponent message={longMessage} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('...');
    expect(frame.length).toBeLessThan(longMessage.length);
  });

  it('handles empty message', () => {
    const { lastFrame } = render(
      <SpinnerComponent message="" />
    );
    expect(lastFrame()).toBeTruthy();
  });

  it('handles message at max length', () => {
    const maxLengthMessage = 'A'.repeat(200);
    const { lastFrame } = render(
      <SpinnerComponent message={maxLengthMessage} />
    );
    
    // Should not truncate at exactly max length
    expect(lastFrame()).not.toContain('...');
  });

  it('handles message just over max length', () => {
    const overMaxMessage = 'A'.repeat(201);
    const { lastFrame } = render(
      <SpinnerComponent message={overMaxMessage} />
    );
    
    expect(lastFrame()).toContain('...');
  });
});


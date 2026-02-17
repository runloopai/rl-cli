/**
 * Tests for ErrorMessage component
 */
import React from 'react';
import { render } from 'ink-testing-library';
import { ErrorMessage } from '../../../src/components/ErrorMessage.js';

describe('ErrorMessage', () => {
  it('renders without crashing', () => {
    const { lastFrame } = render(
      <ErrorMessage message="Test error" />
    );
    expect(lastFrame()).toBeTruthy();
  });

  it('displays the error message', () => {
    const { lastFrame } = render(
      <ErrorMessage message="Something went wrong" />
    );
    expect(lastFrame()).toContain('Something went wrong');
  });

  it('shows cross icon', () => {
    const { lastFrame } = render(
      <ErrorMessage message="Error" />
    );
    expect(lastFrame()).toContain('✗');
  });

  it('displays error details when provided', () => {
    const error = new Error('Detailed error info');
    const { lastFrame } = render(
      <ErrorMessage message="Operation failed" error={error} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('Operation failed');
    expect(frame).toContain('Detailed error info');
  });

  it('truncates long messages', () => {
    const longMessage = 'A'.repeat(600);
    const { lastFrame } = render(
      <ErrorMessage message={longMessage} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('...');
    // Frame should not contain the full untruncated message
    expect(frame).not.toContain(longMessage);
  });

  it('truncates long error details', () => {
    const longError = new Error('B'.repeat(600));
    const { lastFrame } = render(
      <ErrorMessage message="Error" error={longError} />
    );
    
    const frame = lastFrame() || '';
    expect(frame).toContain('...');
  });

  it('handles error without message', () => {
    const { lastFrame } = render(
      <ErrorMessage message="Failed" error={undefined} />
    );
    expect(lastFrame()).toContain('Failed');
  });
});


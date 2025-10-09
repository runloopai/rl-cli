import { jest } from '@jest/globals';

describe('Jest Setup', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to jest globals', () => {
    expect(jest).toBeDefined();
  });

  it('should have access to environment variables', () => {
    expect(process.env.RUNLOOP_ENV).toBe('dev');
  });
});



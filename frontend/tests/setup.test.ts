import { describe, it, expect } from 'vitest';

describe('Frontend Tooling Setup', () => {
  it('runs tests in happy-dom environment', () => {
    expect(window).toBeDefined();
    expect(document).toBeDefined();
    expect(1 + 1).toBe(2);
  });
});

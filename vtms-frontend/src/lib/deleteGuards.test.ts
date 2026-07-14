import { describe, it, expect } from 'vitest';
import { assertNoDependencies, formatDependencyBlock } from './lifecycle';

describe('assertNoDependencies', () => {
  it('does not throw when all counts are zero', () => {
    expect(() => assertNoDependencies('Batch', { trainees: 0, sales: 0 })).not.toThrow();
  });

  it('throws with formatted message when any count is positive', () => {
    const counts = { trainees: 2, sales: 0 };
    const expected = formatDependencyBlock('Batch', counts);
    expect(() => assertNoDependencies('Batch', counts)).toThrow(expected);
  });
});

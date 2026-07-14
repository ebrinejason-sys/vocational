import { describe, it, expect } from 'vitest';
import { resumeBatchStatus, resumeTraineeStatus, formatDependencyBlock } from './lifecycle';

describe('resumeBatchStatus', () => {
  it('returns active when start_date is today or earlier', () => {
    expect(resumeBatchStatus('2026-01-01', '2026-07-14')).toBe('active');
    expect(resumeBatchStatus('2026-07-14', '2026-07-14')).toBe('active');
  });
  it('returns planned when start_date is in the future', () => {
    expect(resumeBatchStatus('2026-12-01', '2026-07-14')).toBe('planned');
  });
});

describe('resumeTraineeStatus', () => {
  it('returns enrolled when trainee has a batch', () => {
    expect(resumeTraineeStatus(true)).toBe('enrolled');
  });
  it('returns prospect when no batch', () => {
    expect(resumeTraineeStatus(false)).toBe('prospect');
  });
});

describe('formatDependencyBlock', () => {
  it('lists only positive counts', () => {
    const msg = formatDependencyBlock('Batch', { trainees: 3, inventory_usage: 0, sales: 1 });
    expect(msg).toContain('Cannot delete Batch');
    expect(msg).toContain('trainees: 3');
    expect(msg).toContain('sales: 1');
    expect(msg).not.toContain('inventory_usage');
  });
});

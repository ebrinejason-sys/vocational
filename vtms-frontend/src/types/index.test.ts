import { COMPETENCY_LEVELS } from './index';

describe('Competency Levels', () => {
  it('should have 4 levels', () => {
    expect(COMPETENCY_LEVELS.length).toBe(4);
  });

  it('should have correct labels', () => {
    const labels = COMPETENCY_LEVELS.map(l => l.label);
    expect(labels).toContain('Beginner');
    expect(labels).toContain('Independent');
  });
});

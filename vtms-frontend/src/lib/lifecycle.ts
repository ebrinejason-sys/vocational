export function resumeBatchStatus(startDate: string, today = new Date().toISOString().slice(0, 10)): 'active' | 'planned' {
  return startDate <= today ? 'active' : 'planned';
}

export function resumeTraineeStatus(hasBatch: boolean): 'enrolled' | 'prospect' {
  return hasBatch ? 'enrolled' : 'prospect';
}

export function formatDependencyBlock(entityLabel: string, counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}: ${n}`);
  return `Cannot delete ${entityLabel} while linked records exist (${parts.join(', ')}). Remove or reassign them first.`;
}

export function assertNoDependencies(entityLabel: string, counts: Record<string, number>): void {
  if (Object.values(counts).some((n) => n > 0)) {
    throw new Error(formatDependencyBlock(entityLabel, counts));
  }
}

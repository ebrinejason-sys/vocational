export type TraineeStatus = 'prospect' | 'enrolled' | 'graduated' | 'dropped' | 'alumni';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Trainee {
  id: string;
  batch_id: string;
  first_name: string;
  last_name: string;
  status: TraineeStatus;
  vulnerability_score: number;
}

export interface Batch {
  id: string;
  name: string;
  trade_name: string;
  status: 'planned' | 'active' | 'completed';
}

export interface CompetencyLevel {
  id: number;
  label: string;
  description: string;
}

export const COMPETENCY_LEVELS: CompetencyLevel[] = [
  { id: 1, label: 'Beginner', description: 'Requires constant supervision' },
  { id: 2, label: 'Developing', description: 'Performs with some guidance' },
  { id: 3, label: 'Proficient', description: 'Performs independently' },
  { id: 4, label: 'Independent', description: 'Can teach others' },
];

export type Role =
  | 'admin'
  | 'director'
  | 'project_coordinator'
  | 'trainer'
  | 'case_worker'
  | 'finance_officer'
  | 'logistics_officer';

export type PermissionLevel = 'none' | 'view' | 'edit' | 'full';

export type Domain =
  | 'batches' | 'trainees' | 'attendance' | 'competency' | 'case_notes'
  | 'inventory' | 'financials' | 'graduation' | 'alumni';

const ALL_ROLES: Role[] = [
  'admin', 'director', 'project_coordinator', 'trainer',
  'case_worker', 'finance_officer', 'logistics_officer',
];

/** Human-readable labels for the SCM staff structure. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  director: 'Director',
  project_coordinator: 'Project Coordinator',
  trainer: 'Trainer',
  case_worker: 'Case Worker',
  finance_officer: 'Finance',
  logistics_officer: 'Logistics & Procurement',
};

// Mirrors the RLS policies in schema.sql — the database is the real
// enforcement layer; this matrix only drives nav/route/control visibility.
const MATRIX: Record<Domain, Record<Role, PermissionLevel>> = {
  batches:    { admin: 'full', director: 'edit', project_coordinator: 'edit', trainer: 'edit', case_worker: 'edit', finance_officer: 'view', logistics_officer: 'view' },
  trainees:   { admin: 'full', director: 'edit', project_coordinator: 'edit', trainer: 'edit', case_worker: 'edit', finance_officer: 'view', logistics_officer: 'view' },
  attendance: { admin: 'full', director: 'view', project_coordinator: 'view', trainer: 'edit', case_worker: 'view', finance_officer: 'none', logistics_officer: 'none' },
  competency: { admin: 'full', director: 'view', project_coordinator: 'view', trainer: 'edit', case_worker: 'view', finance_officer: 'none', logistics_officer: 'none' },
  case_notes: { admin: 'full', director: 'view', project_coordinator: 'none', trainer: 'none', case_worker: 'edit', finance_officer: 'none', logistics_officer: 'none' },
  inventory:  { admin: 'full', director: 'view', project_coordinator: 'view', trainer: 'edit', case_worker: 'none', finance_officer: 'view', logistics_officer: 'edit' },
  financials: { admin: 'full', director: 'view', project_coordinator: 'view', trainer: 'none', case_worker: 'none', finance_officer: 'edit', logistics_officer: 'none' },
  graduation: { admin: 'full', director: 'view', project_coordinator: 'edit', trainer: 'view', case_worker: 'edit', finance_officer: 'none', logistics_officer: 'view' },
  alumni:     { admin: 'full', director: 'view', project_coordinator: 'edit', trainer: 'view', case_worker: 'edit', finance_officer: 'none', logistics_officer: 'none' },
};

export function permissionFor(role: Role, domain: Domain): PermissionLevel {
  return MATRIX[domain][role];
}

export function canView(role: Role, domain: Domain): boolean {
  const level = permissionFor(role, domain);
  return level === 'view' || level === 'edit' || level === 'full';
}

export function canEdit(role: Role, domain: Domain): boolean {
  const level = permissionFor(role, domain);
  return level === 'edit' || level === 'full';
}

export function rolesWithAccess(domain: Domain): Role[] {
  return ALL_ROLES.filter((r) => canView(r, domain));
}

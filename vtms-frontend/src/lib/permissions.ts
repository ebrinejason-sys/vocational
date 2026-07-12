export type Role = 'admin' | 'director' | 'trainer' | 'case_worker' | 'finance_officer';

export type PermissionLevel = 'none' | 'view' | 'edit' | 'full';

export type Domain =
  | 'batches' | 'trainees' | 'attendance' | 'competency' | 'case_notes'
  | 'inventory' | 'financials' | 'graduation' | 'alumni';

const ALL_ROLES: Role[] = ['admin', 'director', 'trainer', 'case_worker', 'finance_officer'];

const MATRIX: Record<Domain, Record<Role, PermissionLevel>> = {
  batches:    { admin: 'full', director: 'edit', trainer: 'edit', case_worker: 'edit', finance_officer: 'view' },
  trainees:   { admin: 'full', director: 'edit', trainer: 'edit', case_worker: 'edit', finance_officer: 'view' },
  attendance: { admin: 'full', director: 'view', trainer: 'edit', case_worker: 'view', finance_officer: 'none' },
  competency: { admin: 'full', director: 'view', trainer: 'edit', case_worker: 'view', finance_officer: 'none' },
  case_notes: { admin: 'full', director: 'view', trainer: 'none', case_worker: 'edit', finance_officer: 'none' },
  inventory:  { admin: 'full', director: 'view', trainer: 'edit', case_worker: 'none', finance_officer: 'view' },
  financials: { admin: 'full', director: 'view', trainer: 'none', case_worker: 'none', finance_officer: 'edit' },
  graduation: { admin: 'full', director: 'view', trainer: 'view', case_worker: 'edit', finance_officer: 'none' },
  alumni:     { admin: 'full', director: 'view', trainer: 'view', case_worker: 'edit', finance_officer: 'none' },
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

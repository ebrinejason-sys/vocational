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

const ALL_DOMAINS: Domain[] = [
  'batches', 'trainees', 'attendance', 'competency', 'case_notes',
  'inventory', 'financials', 'graduation', 'alumni',
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

export const DOMAIN_LABELS: Record<Domain, string> = {
  batches: 'Batches',
  trainees: 'Trainees',
  attendance: 'Attendance',
  competency: 'Competency',
  case_notes: 'Case Management',
  inventory: 'Inventory & Procurement',
  financials: 'Financials',
  graduation: 'Graduation',
  alumni: 'Alumni',
};

// Mirrors the RLS policies in schema.sql — the database is the real
// enforcement layer; this matrix only drives nav/route/control visibility.
const MATRIX: Record<Domain, Record<Role, PermissionLevel>> = {
  batches:    { admin: 'full', director: 'edit', project_coordinator: 'edit', trainer: 'edit', case_worker: 'edit', finance_officer: 'view', logistics_officer: 'view' },
  trainees:   { admin: 'full', director: 'edit', project_coordinator: 'edit', trainer: 'edit', case_worker: 'edit', finance_officer: 'view', logistics_officer: 'view' },
  attendance: { admin: 'full', director: 'view', project_coordinator: 'view', trainer: 'edit', case_worker: 'view', finance_officer: 'view', logistics_officer: 'none' },
  competency: { admin: 'full', director: 'view', project_coordinator: 'view', trainer: 'edit', case_worker: 'view', finance_officer: 'view', logistics_officer: 'none' },
  case_notes: { admin: 'full', director: 'view', project_coordinator: 'none', trainer: 'none', case_worker: 'edit', finance_officer: 'view', logistics_officer: 'none' },
  inventory:  { admin: 'full', director: 'view', project_coordinator: 'view', trainer: 'edit', case_worker: 'none', finance_officer: 'view', logistics_officer: 'edit' },
  financials: { admin: 'full', director: 'view', project_coordinator: 'none', trainer: 'none', case_worker: 'none', finance_officer: 'edit', logistics_officer: 'none' },
  graduation: { admin: 'full', director: 'view', project_coordinator: 'edit', trainer: 'view', case_worker: 'edit', finance_officer: 'view', logistics_officer: 'view' },
  alumni:     { admin: 'full', director: 'view', project_coordinator: 'edit', trainer: 'view', case_worker: 'edit', finance_officer: 'view', logistics_officer: 'none' },
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

/** Domains a role can access, for admin staff management previews. */
export function accessibleDomains(role: Role): { domain: Domain; level: PermissionLevel }[] {
  return ALL_DOMAINS
    .filter((d) => canView(role, d))
    .map((domain) => ({ domain, level: permissionFor(role, domain) }));
}

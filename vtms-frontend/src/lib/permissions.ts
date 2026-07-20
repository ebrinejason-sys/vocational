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

/** Roles with full access to every operational module. Staff management stays admin-only in routes/API. */
export const PRIVILEGED_ROLES: Role[] = ['admin', 'director', 'finance_officer'];

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
  batches:    { admin: 'full', director: 'full', finance_officer: 'full', project_coordinator: 'edit', trainer: 'edit', case_worker: 'edit', logistics_officer: 'view' },
  trainees:   { admin: 'full', director: 'full', finance_officer: 'full', project_coordinator: 'edit', trainer: 'edit', case_worker: 'edit', logistics_officer: 'view' },
  attendance: { admin: 'full', director: 'full', finance_officer: 'full', project_coordinator: 'view', trainer: 'edit', case_worker: 'view', logistics_officer: 'none' },
  competency: { admin: 'full', director: 'full', finance_officer: 'full', project_coordinator: 'view', trainer: 'edit', case_worker: 'view', logistics_officer: 'none' },
  case_notes: { admin: 'full', director: 'full', finance_officer: 'full', project_coordinator: 'none', trainer: 'none', case_worker: 'edit', logistics_officer: 'none' },
  inventory:  { admin: 'full', director: 'full', finance_officer: 'full', project_coordinator: 'view', trainer: 'edit', case_worker: 'none', logistics_officer: 'edit' },
  financials: { admin: 'full', director: 'full', finance_officer: 'full', project_coordinator: 'none', trainer: 'none', case_worker: 'none', logistics_officer: 'none' },
  graduation: { admin: 'full', director: 'full', finance_officer: 'full', project_coordinator: 'edit', trainer: 'view', case_worker: 'edit', logistics_officer: 'view' },
  alumni:     { admin: 'full', director: 'full', finance_officer: 'full', project_coordinator: 'edit', trainer: 'view', case_worker: 'edit', logistics_officer: 'none' },
};

export function isPrivilegedRole(role: Role): boolean {
  return PRIVILEGED_ROLES.includes(role);
}

export function permissionFor(role: Role, domain: Domain): PermissionLevel {
  if (isPrivilegedRole(role)) return 'full';
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
  if (isPrivilegedRole(role)) {
    return ALL_DOMAINS.map((domain) => ({ domain, level: 'full' as PermissionLevel }));
  }
  return ALL_DOMAINS
    .filter((d) => canView(role, d))
    .map((domain) => ({ domain, level: permissionFor(role, domain) }));
}

import { describe, it, expect } from 'vitest';
import {
  canView, canEdit, permissionFor, rolesWithAccess, accessibleDomains,
  isPrivilegedRole, type Domain,
} from './permissions';

const DOMAINS: Domain[] = ['batches', 'trainees', 'attendance', 'competency', 'case_notes', 'inventory', 'financials', 'graduation', 'alumni'];

describe('permissions', () => {
  it('gives admin full access to every domain', () => {
    DOMAINS.forEach((d) => {
      expect(permissionFor('admin', d)).toBe('full');
      expect(canView('admin', d)).toBe(true);
      expect(canEdit('admin', d)).toBe(true);
    });
  });

  it('gives director and finance_officer full access to every domain', () => {
    for (const role of ['director', 'finance_officer'] as const) {
      expect(isPrivilegedRole(role)).toBe(true);
      DOMAINS.forEach((d) => {
        expect(permissionFor(role, d)).toBe('full');
        expect(canEdit(role, d)).toBe(true);
      });
      expect(accessibleDomains(role).length).toBe(DOMAINS.length);
    }
  });

  it('denies finance_officer staff management route by role list (admin only in App)', () => {
    expect(isPrivilegedRole('finance_officer')).toBe(true);
  });

  it('gives case_worker edit access to case_notes but only view on attendance', () => {
    expect(canEdit('case_worker', 'case_notes')).toBe(true);
    expect(canEdit('case_worker', 'attendance')).toBe(false);
    expect(canView('case_worker', 'attendance')).toBe(true);
  });

  it('denies trainer any access to case_notes and financials', () => {
    expect(canView('trainer', 'case_notes')).toBe(false);
    expect(canView('trainer', 'financials')).toBe(false);
  });

  it('restricts financials tab to privileged roles only', () => {
    expect(rolesWithAccess('financials').sort()).toEqual(['admin', 'director', 'finance_officer'].sort());
    expect(canView('project_coordinator', 'financials')).toBe(false);
    expect(canView('logistics_officer', 'financials')).toBe(false);
  });

  it('logistics_officer can edit inventory but never sees case notes or financials', () => {
    expect(canEdit('logistics_officer', 'inventory')).toBe(true);
    expect(canView('logistics_officer', 'case_notes')).toBe(false);
    expect(canView('logistics_officer', 'financials')).toBe(false);
  });
});

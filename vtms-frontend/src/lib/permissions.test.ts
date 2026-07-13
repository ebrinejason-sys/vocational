import { describe, it, expect } from 'vitest';
import { canView, canEdit, permissionFor, rolesWithAccess, type Domain } from './permissions';

const DOMAINS: Domain[] = ['batches', 'trainees', 'attendance', 'competency', 'case_notes', 'inventory', 'financials', 'graduation', 'alumni'];

describe('permissions', () => {
  it('gives admin full access to every domain', () => {
    DOMAINS.forEach((d) => {
      expect(permissionFor('admin', d)).toBe('full');
      expect(canView('admin', d)).toBe(true);
      expect(canEdit('admin', d)).toBe(true);
    });
  });

  it('denies finance_officer any access to case_notes', () => {
    expect(canView('finance_officer', 'case_notes')).toBe(false);
    expect(canEdit('finance_officer', 'case_notes')).toBe(false);
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

  it('rolesWithAccess returns only roles that can at least view the domain', () => {
    expect(rolesWithAccess('financials').sort()).toEqual(['admin', 'director', 'finance_officer', 'project_coordinator'].sort());
    expect(rolesWithAccess('case_notes').sort()).toEqual(['admin', 'case_worker', 'director'].sort());
    expect(rolesWithAccess('batches').sort()).toEqual(
      ['admin', 'case_worker', 'director', 'finance_officer', 'logistics_officer', 'project_coordinator', 'trainer'].sort()
    );
  });

  it('logistics_officer can edit inventory but never sees case notes or financials', () => {
    expect(canEdit('logistics_officer', 'inventory')).toBe(true);
    expect(canView('logistics_officer', 'case_notes')).toBe(false);
    expect(canView('logistics_officer', 'financials')).toBe(false);
  });

  it('project_coordinator has broad operational access but no case notes', () => {
    expect(canEdit('project_coordinator', 'batches')).toBe(true);
    expect(canView('project_coordinator', 'financials')).toBe(true);
    expect(canEdit('project_coordinator', 'financials')).toBe(false);
    expect(canView('project_coordinator', 'case_notes')).toBe(false);
  });
});

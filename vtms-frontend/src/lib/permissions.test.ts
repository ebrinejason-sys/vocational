import { describe, it, expect } from 'vitest';
import { canView, canEdit, permissionFor, rolesWithAccess, accessibleDomains, type Domain } from './permissions';

const DOMAINS: Domain[] = ['batches', 'trainees', 'attendance', 'competency', 'case_notes', 'inventory', 'financials', 'graduation', 'alumni'];

describe('permissions', () => {
  it('gives admin full access to every domain', () => {
    DOMAINS.forEach((d) => {
      expect(permissionFor('admin', d)).toBe('full');
      expect(canView('admin', d)).toBe(true);
      expect(canEdit('admin', d)).toBe(true);
    });
  });

  it('gives finance_officer view access to all operational domains and edit on financials', () => {
    expect(canView('finance_officer', 'batches')).toBe(true);
    expect(canView('finance_officer', 'trainees')).toBe(true);
    expect(canView('finance_officer', 'attendance')).toBe(true);
    expect(canView('finance_officer', 'competency')).toBe(true);
    expect(canView('finance_officer', 'case_notes')).toBe(true);
    expect(canView('finance_officer', 'inventory')).toBe(true);
    expect(canView('finance_officer', 'graduation')).toBe(true);
    expect(canView('finance_officer', 'alumni')).toBe(true);
    expect(canEdit('finance_officer', 'financials')).toBe(true);
    expect(canEdit('finance_officer', 'batches')).toBe(false);
    expect(accessibleDomains('finance_officer').length).toBe(DOMAINS.length);
  });

  it('denies finance_officer edit on case_notes', () => {
    expect(canView('finance_officer', 'case_notes')).toBe(true);
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

  it('restricts financials tab to admin, director, and finance_officer only', () => {
    expect(rolesWithAccess('financials').sort()).toEqual(['admin', 'director', 'finance_officer'].sort());
    expect(canView('project_coordinator', 'financials')).toBe(false);
    expect(canView('logistics_officer', 'financials')).toBe(false);
  });

  it('rolesWithAccess returns only roles that can at least view the domain', () => {
    expect(rolesWithAccess('case_notes').sort()).toEqual(['admin', 'case_worker', 'director', 'finance_officer'].sort());
    expect(rolesWithAccess('batches').sort()).toEqual(
      ['admin', 'case_worker', 'director', 'finance_officer', 'logistics_officer', 'project_coordinator', 'trainer'].sort()
    );
  });

  it('logistics_officer can edit inventory but never sees case notes or financials', () => {
    expect(canEdit('logistics_officer', 'inventory')).toBe(true);
    expect(canView('logistics_officer', 'case_notes')).toBe(false);
    expect(canView('logistics_officer', 'financials')).toBe(false);
  });

  it('project_coordinator has broad operational access but no case notes or financials', () => {
    expect(canEdit('project_coordinator', 'batches')).toBe(true);
    expect(canView('project_coordinator', 'financials')).toBe(false);
    expect(canEdit('project_coordinator', 'financials')).toBe(false);
    expect(canView('project_coordinator', 'case_notes')).toBe(false);
  });
});

import type {
  Module, CompetencyAssessment, AttendanceRecord, CaseNote,
  ProductionLog, Sale, FinancialTransaction, StarterKit, AlumniFollowUp, JobPlacement,
} from '../types';

// All demo/fictional data has been removed. Batches, trainees, inventory,
// usage logs, and procurement requests live in Supabase. Domains below
// start empty and stay browser-local until each is wired to its table.
// Real CBET curriculum modules will be entered per trade via the UI once
// module management ships (Phase 2 — Batch structure & setup).

export const SEED_MODULES: Module[] = [];
export const SEED_COMPETENCY_ASSESSMENTS: CompetencyAssessment[] = [];
export const SEED_ATTENDANCE: AttendanceRecord[] = [];
export const SEED_CASE_NOTES: CaseNote[] = [];
export const SEED_PRODUCTION_LOGS: ProductionLog[] = [];
export const SEED_SALES: Sale[] = [];
export const SEED_FINANCIALS: FinancialTransaction[] = [];
export const SEED_STARTER_KITS: StarterKit[] = [];
export const SEED_ALUMNI_FOLLOWUPS: AlumniFollowUp[] = [];
export const SEED_JOB_PLACEMENTS: JobPlacement[] = [];
